import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { TransactionDetails } from "./entities/transaction.details";
import {
  Address,
  AddressValue,
  BytesType,
  BytesValue,
  TokenTransfer,
  Transaction,
  TransactionHash,
  TypedValue,
  VariadicType,
  VariadicValue,
} from "@multiversx/sdk-core/out";
import { ApiConfigService, CacheInfo, ContractLoader } from "@mvx-monorepo/common";
import BigNumber from "bignumber.js";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { CachedPaymasterTxData } from "./entities/cached.paymaster.tx.data";
import { TokenService } from "../tokens/token.service";
import { TransactionUtils } from "./transaction.utils";

@Injectable()
export class PaymasterService {
  private readonly logger: Logger;
  private readonly contractLoader: ContractLoader;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly cacheService: CacheService,
    private readonly tokenService: TokenService,
  ) {
    this.logger = new Logger(PaymasterService.name);
    this.contractLoader = new ContractLoader(`apps/api/src/abis/paymaster.abi.json`);
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
    const metadata = TransactionUtils.extractMetadata(txDetails);

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
      ...TransactionUtils.extractTransfersFromMetadata(metadata),
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

    await this.setCachedTxData(transaction, gasLimit);

    return transaction;
  }

  async setCachedTxData(transaction: Transaction, gasLimit: number) {
    const cacheValue: CachedPaymasterTxData = {
      hash: TransactionHash.compute(transaction).hex(),
      gasLimit: gasLimit,
    };
    const cacheInfo = CacheInfo.PaymasterTx(
      transaction.getSender().bech32(),
      transaction.getNonce().valueOf()
    );

    await this.cacheService.setRemote(
      cacheInfo.key,
      cacheValue,
      cacheInfo.ttl
    );
  }

  async getCachedTxData(txObject: TransactionDetails): Promise<CachedPaymasterTxData> {
    if (txObject.signature) {
      delete txObject.signature;
    }

    const transaction = TransactionUtils.convertObjectToTransaction(txObject);
    const transactionHash = TransactionHash.compute(transaction);

    const txData = await this.cacheService.getRemote<CachedPaymasterTxData>(
      CacheInfo.PaymasterTx(txObject.sender, txObject.nonce).key
    );

    if (!txData) {
      this.logger.warn('Invalid or expired paymaster transaction', txObject);

      throw new BadRequestException('Invalid or expired paymaster transaction');
    }

    if (transactionHash.hex() !== txData.hash) {
      throw new BadRequestException('Transaction hash mismatch');
    }

    return txData;
  }
}
