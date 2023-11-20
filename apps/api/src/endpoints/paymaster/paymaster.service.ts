import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { TransactionDetails } from "./entities/transaction.details";
import {
  Address,
  TokenTransfer,
  Transaction,
  TransactionHash,
  TypedValue,
} from "@multiversx/sdk-core/out";
import { AbiPaymaster, ApiConfigService, CacheInfo } from "@mvx-monorepo/common";
import BigNumber from "bignumber.js";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { CachedPaymasterTxData } from "./entities/cached.paymaster.tx.data";
import { TokenService } from "../tokens/token.service";
import { TransactionUtils } from "./transaction.utils";
import { NetworkConfig } from "@multiversx/sdk-network-providers/out";
import { TokenConfig } from "../tokens/entities/token.config";
import { AddressUtils } from "@multiversx/sdk-nestjs-common";
import { SignerUtils } from "../../utils/signer.utils";
import { ApiService } from "../../common/api/api.service";
import { DrainProtectionService } from "../../drain-protection/drain.protection.service";

@Injectable()
export class PaymasterService {
  private readonly logger: Logger;
  private networkConfig: NetworkConfig | undefined = undefined;
  private readonly abiPaymaster = new AbiPaymaster();

  constructor(
    private readonly configService: ApiConfigService,
    private readonly cacheService: CacheService,
    private readonly tokenService: TokenService,
    private readonly apiService: ApiService,
    private readonly signerUtils: SignerUtils,
    private readonly drainProtectionService: DrainProtectionService
  ) {
    this.logger = new Logger(PaymasterService.name);
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

    const senderIsBanned = await this.drainProtectionService.isAddressBanned(metadata.sender);
    if (senderIsBanned) {
      this.logger.warn(`${metadata.sender} is attempting to submit a transaction while being timed out`);

      throw new ForbiddenException('Too many failed transactions in the past hour');
    }

    const systemIsPaused = await this.drainProtectionService.isSystemPaused();
    if (systemIsPaused) {
      throw new ForbiddenException('Too many failed transactions in the past hour');
    }

    const receiverAddress = Address.fromBech32(metadata.receiver);

    const relayerAddress = this.signerUtils.getAddressFromPem();
    const gasLimit = this.configService.getPaymasterGasLimit() + txDetails.gasLimit;

    const typedArguments = this.abiPaymaster.getTypedSCArguments(relayerAddress, metadata);

    const existingTransfers = TransactionUtils.extractTransfersFromMetadata(metadata);

    const dummyRelayerTransfer = this.getDummyRelayerPayment();
    const tempTransfer = [dummyRelayerTransfer, ...existingTransfers];
    const tempTransaction = await this.buildPaymasterTx(txDetails, receiverAddress, typedArguments, tempTransfer, gasLimit);

    const networkConfig = await this.getNetworkConfig();
    const fee = BigNumber(tempTransaction.computeFee(networkConfig));
    const multiTransfer = [
      await this.getRelayerPayment(fee, token),
      ...existingTransfers,
    ];
    const transaction = await this.buildPaymasterTx(txDetails, receiverAddress, typedArguments, multiTransfer, 0);
    transaction.setVersion(txDetails.version ?? 1);
    transaction.setOptions(0);

    await this.setCachedTxData(transaction, gasLimit);

    return transaction;
  }

  async buildPaymasterTx(initialTx: TransactionDetails, receiverAddress: Address, scArguments: TypedValue[], multiTransfer: TokenTransfer[], gasLimit: number):
    Promise<Transaction> {
    const numberOfShards = this.configService.getNumberOfShards();
    const receiverShard = AddressUtils.computeShard(receiverAddress.hex(), numberOfShards);
    const paymasterAddress = this.configService.getPaymasterContractAddress(receiverShard);

    return await this.abiPaymaster.forwardExecution(initialTx.sender, paymasterAddress, scArguments, multiTransfer, gasLimit, initialTx.gasPrice, initialTx.nonce, initialTx.chainID);
  }

  getDummyRelayerPayment() {
    const wrappedEgldIdentifier = this.configService.getWrappedEGLDIdentifier();
    const dummyFee = BigNumber('0.00056').multipliedBy('1e+18');
    return TokenTransfer.fungibleFromBigInteger(wrappedEgldIdentifier, dummyFee, 18);
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
      this.networkConfig = await this.apiService.loadNetworkConfig();
    }

    return this.networkConfig;
  }
}
