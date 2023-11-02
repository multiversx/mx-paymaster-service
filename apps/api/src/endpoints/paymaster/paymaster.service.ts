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
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers/out";
import { TokenConfig } from "../tokens/entities/token.config";
import { PaymasterArguments } from "./entities/paymaster.arguments";

@Injectable()
export class PaymasterService {
  private readonly logger: Logger;
  private readonly contractLoader: ContractLoader;
  private readonly networkProvider: ApiNetworkProvider;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly cacheService: CacheService,
    private readonly tokenService: TokenService,
  ) {
    this.logger = new Logger(PaymasterService.name);
    this.contractLoader = new ContractLoader(`apps/api/src/abis/paymaster.abi.json`);
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
  }

  async getRelayerPayment(feeEgldAmount: BigNumber, token: TokenConfig): Promise<TokenTransfer> {
    const flatFee = BigNumber(token.feeAmount);
    const feePercentage = BigNumber(token.feePercentage);

    const [egldPrice, feeToken] = await Promise.all([
      this.tokenService.getEGLDPrice(),
      this.tokenService.getTokenDetails(token.identifier),
    ]);

    if (!feeToken.price || !feeToken.decimals) {
      throw new BadRequestException('Missing token price or decimals');
    }

    console.log('feeEgldAmount', feeEgldAmount.toString());
    const feeTokenAmount = this.tokenService.convertEGLDtoToken(
      feeEgldAmount,
      BigNumber(egldPrice),
      BigNumber(feeToken.price),
      feeToken.decimals
    );

    const tokenAmount = feeTokenAmount.plus(flatFee);
    const percentageAmount = tokenAmount.multipliedBy(feePercentage).dividedToIntegerBy(100);
    const finalAmount = tokenAmount.plus(percentageAmount);
    console.log('finalAmount', finalAmount.toString());
    return TokenTransfer.fungibleFromBigInteger(token.identifier, finalAmount, feeToken.decimals);
  }

  async generatePaymasterTx(txDetails: TransactionDetails, tokenIdentifier: string): Promise<Transaction> {
    const token = this.tokenService.findByIdentifier(tokenIdentifier);
    this.tokenService.findByIdentifier(tokenIdentifier);
    const metadata = TransactionUtils.extractMetadata(txDetails);

    if (metadata.value.toString() !== '0') {
      throw new BadRequestException('Value transfer is not allowed');
    }

    if (!metadata.functionName) {
      throw new BadRequestException('Missing function call');
    }

    const networkConfig = await this.networkProvider.getNetworkConfig();
    const relayerAddress = this.configService.getRelayerAddress();
    const gasLimit = this.configService.getPaymasterGasLimit() + txDetails.gasLimit;

    const typedArguments = this.getTypedSCArguments({
      relayerAddress: relayerAddress,
      destinationAddress: metadata.receiver,
      functionName: metadata.functionName,
      functionParams: metadata.functionArgs,
    });

    const existingTransfers = TransactionUtils.extractTransfersFromMetadata(metadata);

    const dummyRelayerTransfer = this.getDummyRelayerPayment();
    const tempTransfer = [dummyRelayerTransfer, ...existingTransfers];
    const tempTransaction = await this.buildPaymasterTx(txDetails, typedArguments, tempTransfer, gasLimit);

    const fee = BigNumber(tempTransaction.computeFee(networkConfig));
    const multiTransfer = [
      await this.getRelayerPayment(fee, token),
      ...existingTransfers,
    ];
    const transaction = await this.buildPaymasterTx(txDetails, typedArguments, multiTransfer, 0);

    await this.setCachedTxData(transaction, gasLimit);

    return transaction;
  }

  async buildPaymasterTx(initialTx: TransactionDetails, scArguments: TypedValue[], multiTransfer: TokenTransfer[], gasLimit: number):
    Promise<Transaction> {
    const paymasterAddress = this.configService.getPaymasterContractAddress();
    const signerAddress = new Address(initialTx.sender);

    const contract = await this.contractLoader.getContract(paymasterAddress);
    const transaction = contract.methodsExplicit
      .forwardExecution(
        scArguments
      ).withSender(
        signerAddress
      ).withGasLimit(
        gasLimit
      ).withGasPrice(
        initialTx.gasPrice
      ).withMultiESDTNFTTransfer(
        multiTransfer
      ).withNonce(
        initialTx.nonce
      ).withChainID(
        initialTx.chainID
      ).buildTransaction();
    return transaction;
  }

  getDummyRelayerPayment() {
    const wrappedEgldIdentigier = this.configService.getWrappedEGLDIdentifier();
    const dummyFee = BigNumber('0.00056').multipliedBy('1e+18');
    return TokenTransfer.fungibleFromBigInteger(wrappedEgldIdentigier, dummyFee, 18);
  }

  getTypedSCArguments(plainArguments: PaymasterArguments): TypedValue[] {
    let endpointParams: TypedValue[] = [];
    if (plainArguments.functionParams) {
      endpointParams = plainArguments.functionParams.map((element) =>
        BytesValue.fromHex(element)
      );
    }

    return [
      new AddressValue(new Address(plainArguments.relayerAddress)),
      new AddressValue(new Address(plainArguments.destinationAddress)),
      BytesValue.fromUTF8(plainArguments.functionName),
      new VariadicValue(new VariadicType(new BytesType()), endpointParams),
    ];
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
    const clonedTx = { ...txObject };
    if (clonedTx.signature) {
      delete clonedTx.signature;
    }

    const transaction = TransactionUtils.convertObjectToTransaction(clonedTx);
    const transactionHash = TransactionHash.compute(transaction);

    const txData = await this.cacheService.getRemote<CachedPaymasterTxData>(
      CacheInfo.PaymasterTx(clonedTx.sender, clonedTx.nonce).key
    );

    if (!txData) {
      this.logger.warn('Invalid or expired paymaster transaction', clonedTx);

      throw new BadRequestException('Invalid or expired paymaster transaction');
    }

    if (transactionHash.hex() !== txData.hash) {
      throw new BadRequestException('Transaction hash mismatch');
    }

    return txData;
  }
}
