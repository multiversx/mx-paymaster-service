import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { TransactionDetails } from "./entities/transaction.details";
import {
  Address,
  AddressValue,
  BytesType,
  BytesValue,
  SmartContract,
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
import { ApiNetworkProvider, NetworkConfig } from "@multiversx/sdk-network-providers/out";
import { TokenConfig } from "../tokens/entities/token.config";
import { PaymasterArguments } from "./entities/paymaster.arguments";
import { PaymasterAbiJson } from "../../abis/paymaster.abi";

@Injectable()
export class PaymasterService {
  private readonly logger: Logger;
  private readonly contractLoader: ContractLoader;
  private readonly networkProvider: ApiNetworkProvider;
  private networkConfig: NetworkConfig | undefined = undefined;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly cacheService: CacheService,
    private readonly tokenService: TokenService,
  ) {
    this.logger = new Logger(PaymasterService.name);

    this.contractLoader = new ContractLoader(PaymasterAbiJson);
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

    const feeTokenAmount = this.tokenService.convertEGLDtoToken(
      feeEgldAmount,
      BigNumber(egldPrice),
      BigNumber(feeToken.price),
      feeToken.decimals
    );

    const tokenAmount = feeTokenAmount.plus(flatFee);
    const percentageAmount = tokenAmount.multipliedBy(feePercentage).dividedToIntegerBy(100);
    const finalAmount = tokenAmount.plus(percentageAmount);

    return TokenTransfer.fungibleFromBigInteger(token.identifier, finalAmount, feeToken.decimals);
  }

  async generatePaymasterTx(txDetails: TransactionDetails, tokenIdentifier: string): Promise<Transaction> {
    const token = this.tokenService.findByIdentifier(tokenIdentifier);
    const metadata = TransactionUtils.extractMetadata(txDetails);

    if (txDetails.value !== '0') {
      throw new BadRequestException('Value transfer is not allowed');
    }

    if (!metadata.functionName && !metadata.transfers) {
      throw new BadRequestException('Missing function call');
    }

    const paymasterAddress = this.configService.getPaymasterContractAddress();
    const contract = await this.contractLoader.getContract(paymasterAddress);
    const relayerAddress = this.configService.getRelayerAddress();
    const gasLimit = this.configService.getPaymasterGasLimit() + txDetails.gasLimit;

    const typedArguments = this.getTypedSCArguments({
      relayerAddress: relayerAddress,
      destinationAddress: metadata.receiver,
      functionName: metadata.functionName ?? '',
      functionParams: metadata.functionArgs,
    });

    const existingTransfers = TransactionUtils.extractTransfersFromMetadata(metadata);

    const dummyRelayerTransfer = this.getDummyRelayerPayment();
    const tempTransfer = [dummyRelayerTransfer, ...existingTransfers];
    const tempTransaction = this.buildPaymasterTx(txDetails, contract, typedArguments, tempTransfer, gasLimit);

    const networkConfig = await this.getNetworkConfig();
    const fee = BigNumber(tempTransaction.computeFee(networkConfig));
    const multiTransfer = [
      await this.getRelayerPayment(fee, token),
      ...existingTransfers,
    ];
    const transaction = this.buildPaymasterTx(txDetails, contract, typedArguments, multiTransfer, 0);
    transaction.setVersion(txDetails.version ?? 1);
    transaction.setOptions(0);

    await this.setCachedTxData(transaction, gasLimit);

    return transaction;
  }

  buildPaymasterTx(initialTx: TransactionDetails, contract: SmartContract, scArguments: TypedValue[], multiTransfer: TokenTransfer[], gasLimit: number):
    Transaction {
    const signerAddress = new Address(initialTx.sender);
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
    const wrappedEgldIdentifier = this.configService.getWrappedEGLDIdentifier();
    const dummyFee = BigNumber('0.00056').multipliedBy('1e+18');
    return TokenTransfer.fungibleFromBigInteger(wrappedEgldIdentifier, dummyFee, 18);
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

      throw new NotFoundException('Paymaster transaction not found');
    }

    if (transactionHash.hex() !== txData.hash) {
      throw new BadRequestException('Transaction hash mismatch');
    }

    return txData;
  }

  async getNetworkConfig(): Promise<NetworkConfig> {
    if (!this.networkConfig) {
      this.networkConfig = await this.loadNetworkConfig();
    }

    return this.networkConfig;
  }

  async loadNetworkConfig(): Promise<NetworkConfig> {
    try {
      const networkConfig: NetworkConfig = await this.networkProvider.getNetworkConfig();

      return networkConfig;
    } catch (error) {
      this.logger.log(`Unexpected error when trying to load network config`);
      this.logger.error(error);

      throw new Error('Error when loading network config');
    }
  }
}
