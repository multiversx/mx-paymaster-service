import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { TransactionDetails } from "./entities/transaction.details";
import {
  Address,
  AddressValue,
  BytesType,
  BytesValue,
  RelayedTransactionV2Builder,
  TokenTransfer,
  Transaction,
  TransactionHash,
  TypedValue,
  VariadicType,
  VariadicValue,
} from "@multiversx/sdk-core/out";
import { ApiConfigService, CacheInfo, ContractLoader } from "@mvx-monorepo/common";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers/out";
import { TransactionDecoder, TransactionMetadata } from "@multiversx/sdk-transaction-decoder/lib/src/transaction.decoder";
import BigNumber from "bignumber.js";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { CachedPaymasterTxData } from "./entities/cached.paymaster.tx.data";
import { promises } from "fs";
import { UserSigner } from "@multiversx/sdk-wallet/out";
import { TokenService } from "../tokens/token.service";
import { Constants } from "@multiversx/sdk-nestjs-common";

@Injectable()
export class TransactionService {
  private readonly logger: Logger;
  private readonly contractLoader: ContractLoader;
  private readonly networkProvider: ApiNetworkProvider;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly cacheService: CacheService,
    private readonly tokenService: TokenService,
    private readonly cachingService: CacheService
  ) {
    this.logger = new Logger(TransactionService.name);
    this.contractLoader = new ContractLoader(`apps/api/src/abis/paymaster.abi.json`);
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
  }

  async calculateRelayerPayment(gasLimit: number, tokenIdentifier: string): Promise<TokenTransfer> {
    const flatFee = BigNumber(this.configService.getRelayerEGLDFee());
    const egldAmount = BigNumber(gasLimit).plus(flatFee);
    const wrappedEgldIndentifier = this.configService.getWrappedEGLDIdentifier();

    const [wrappedEgld, token] = await Promise.all([
      this.tokenService.getTokenDetails(wrappedEgldIndentifier),
      this.tokenService.getTokenDetails(tokenIdentifier),
    ]);

    if (!token.price || !token.decimals || !wrappedEgld.price) {
      throw new BadRequestException('Missing token price or decimals');
    }

    const tokenAmount = this.tokenService.convertEGLDtoToken(
      egldAmount,
      wrappedEgld.price,
      token.price,
      token.decimals
    );

    return TokenTransfer.fungibleFromBigInteger(tokenIdentifier, tokenAmount, token.decimals);
  }

  async generatePaymasterTx(txDetails: TransactionDetails, tokenIdentifier: string): Promise<Transaction> {
    const token = await this.tokenService.findByIdentifier(tokenIdentifier);
    const metadata = this.extractMetadata(txDetails);

    if (metadata.value.toString() !== '0') {
      throw new BadRequestException('Value transfer is not allowed');
    }

    if (!metadata.functionName) {
      throw new BadRequestException('Missing function call');
    }

    const paymasterAddress = this.configService.getPaymasterContractAddress();
    const relayerAddress = this.configService.getRelayerAddress();
    const signerAddress = new Address(txDetails.sender);

    const contract = await this.contractLoader.getContract(paymasterAddress);
    const gasLimit = this.configService.getPaymasterGasLimit() + txDetails.gasLimit;

    let endpointParams: TypedValue[] = [];
    if (metadata.functionArgs) {
      endpointParams = metadata.functionArgs.map((element) =>
        BytesValue.fromHex(element)
      );
    }

    const multiTransfer = [
      await this.calculateRelayerPayment(gasLimit, token.identifier),
      ...this.extractTransfersFromMetadata(metadata),
    ];

    const transaction = contract.methodsExplicit
      .forwardExecution([
        new AddressValue(new Address(relayerAddress)),
        new AddressValue(new Address(metadata.receiver)),
        BytesValue.fromUTF8(metadata.functionName),
        new VariadicValue(new VariadicType(new BytesType()), endpointParams),
      ]).withSender(
        signerAddress
      ).withGasLimit(
        0
      ).withMultiESDTNFTTransfer(
        multiTransfer
      ).withNonce(
        txDetails.nonce
      ).withChainID(
        txDetails.chainID
      ).buildTransaction();

    // const transaction = await this.txGenerator.createTransaction(interaction, signerAddress);
    const cacheValue: CachedPaymasterTxData = {
      hash: TransactionHash.compute(transaction).hex(),
      gasLimit: gasLimit,
    };

    await this.cacheService.setRemote(
      CacheInfo.PaymasterTx(signerAddress.bech32(), txDetails.nonce).key,
      cacheValue,
      CacheInfo.PaymasterTx(signerAddress.bech32(), txDetails.nonce).ttl
    );

    return transaction;
  }

  async generateRelayedTx(paymasterTx: TransactionDetails): Promise<Transaction> {
    if (!paymasterTx.signature) {
      throw new BadRequestException('Missing transaction signature');
    }
    const userSignature = paymasterTx.signature;
    delete paymasterTx.signature;

    const unsignedInnerTx = this.convertObjectToTransaction(paymasterTx);
    const unsignedInnerTxHash = TransactionHash.compute(unsignedInnerTx);

    const generatedPaymasterTx: CachedPaymasterTxData | undefined = await this.cacheService.getRemote(
      CacheInfo.PaymasterTx(paymasterTx.sender, paymasterTx.nonce).key
    );

    if (!generatedPaymasterTx) {
      throw new BadRequestException('Invalid or expired paymaster transaction');
    }

    if (unsignedInnerTxHash.hex() !== generatedPaymasterTx.hash) {
      throw new BadRequestException('Transaction hash mismatch');
    }

    const innerTx = this.convertObjectToTransaction({
      signature: userSignature,
      ...paymasterTx,
    });

    const relayerAddress = this.configService.getRelayerAddress();
    const relayerNonce = await this.getAccountNonce(relayerAddress);

    const networkConfig = await this.networkProvider.getNetworkConfig();
    const builder = new RelayedTransactionV2Builder();

    try {
      const relayedTxV2 = builder
        .setInnerTransaction(innerTx)
        .setInnerTransactionGasLimit(generatedPaymasterTx.gasLimit)
        .setRelayerNonce(relayerNonce)
        .setNetworkConfig(networkConfig)
        .setRelayerAddress(new Address(relayerAddress))
        .build();

      const relayerSignature = await this.signRelayedTx(relayedTxV2);
      relayedTxV2.applySignature(relayerSignature);

      return relayedTxV2;
    } catch (error) {
      this.logger.error(error);

      throw new BadRequestException('Failed to build relayed transaction');
    }
  }

  async broadcastRelayedTx(transaction: Transaction): Promise<string> {
    const txHash = await this.networkProvider.sendTransaction(transaction);
    return txHash;
  }

  async signRelayedTx(transaction: Transaction): Promise<Buffer> {
    const pemText = await promises.readFile(
      this.configService.getRelayerPEMFilePath(),
      { encoding: "utf8" }
    );
    const signer = UserSigner.fromPem(pemText);

    const serializedTransaction = transaction.serializeForSigning();
    return await signer.sign(serializedTransaction);
  }

  convertObjectToTransaction(plainTx: TransactionDetails): Transaction {
    const transaction = Transaction.fromPlainObject({
      nonce: plainTx.nonce,
      sender: plainTx.sender,
      receiver: plainTx.receiver,
      value: '0',
      gasLimit: plainTx.gasLimit,
      gasPrice: plainTx.gasPrice,
      chainID: plainTx.chainID,
      data: plainTx.data,
      signature: plainTx.signature,
      version: plainTx.version ?? 1,
    });
    return transaction;
  }

  async getAccountNonce(address: string): Promise<number> {
    return await this.cachingService.getOrSet(
      CacheInfo.AccountNonce(address).key,
      async () => await this.getAccountNonceRaw(address),
      CacheInfo.AccountNonce(address).ttl,
      Constants.oneSecond()
    );
  }

  async getAccountNonceRaw(address: string): Promise<number> {
    const account = await this.networkProvider.getAccount(new Address(address));
    return account.nonce;
  }

  extractMetadata(txDetails: TransactionDetails): TransactionMetadata {
    const decoder = new TransactionDecoder();
    const metadata = decoder.getTransactionMetadata({
      sender: txDetails.sender,
      receiver: txDetails.receiver,
      data: txDetails.data ?? '',
      value: txDetails.value,
    });

    return metadata;
  }

  extractTransfersFromMetadata(metadata: TransactionMetadata): TokenTransfer[] {
    if (!metadata.transfers) {
      return [];
    }

    return metadata.transfers.map((element) => {
      if (element.properties?.token) {
        return TokenTransfer.fungibleFromBigInteger(
          element.properties.token,
          new BigNumber(element.value.toString())
        );
      }

      if (element.properties?.collection && element.properties.identifier) {
        const nonce = element.properties.identifier?.split('-')[2];
        return TokenTransfer.nonFungible(
          element.properties.collection,
          parseInt(nonce, 16)
        );
      }

      if (!element.properties?.identifier) {
        throw new BadRequestException('Invalid token transfer in data');
      }

      const tokenInfo = element.properties?.identifier?.split('-');
      const nonce = tokenInfo?.length === 3 ? tokenInfo[2] : '0';
      const identifier = tokenInfo[0] + '-' + tokenInfo[1];
      return TokenTransfer.metaEsdtFromBigInteger(
        identifier,
        parseInt(nonce, 16),
        new BigNumber(element.value.toString())
      );
    });
  }
}
