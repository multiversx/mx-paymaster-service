import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { TransactionDetails } from "../paymaster/entities/transaction.details";
import { Address, RelayedTransactionV2Builder, Transaction } from "@multiversx/sdk-core/out";
import { TransactionUtils } from "../paymaster/transaction.utils";
import { ApiConfigService, CacheInfo } from "@mvx-monorepo/common";
import { ApiNetworkProvider, NetworkConfig } from "@multiversx/sdk-network-providers/out";
import { promises } from "fs";
import { UserSigner } from "@multiversx/sdk-wallet/out";
import { OriginLogger } from "@multiversx/sdk-nestjs-common";
import { PaymasterService } from "../paymaster/paymaster.service";
import { RedlockService } from "@mvx-monorepo/common/redlock";
import { RedisCacheService } from "@multiversx/sdk-nestjs-cache";

@Injectable()
export class RelayerService {
  private readonly logger = new OriginLogger(RelayerService.name);
  private readonly networkProvider: ApiNetworkProvider;
  private relayerSigner!: UserSigner;
  private networkConfig: NetworkConfig | undefined = undefined;
  private relayerAddress: string;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly paymasterServer: PaymasterService,
    private readonly redlockService: RedlockService,
    private readonly redisCacheService: RedisCacheService,
  ) {
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
    this.relayerAddress = this.configService.getRelayerAddress();
  }

  async generateRelayedTx(paymasterTx: TransactionDetails): Promise<Transaction> {
    if (!paymasterTx.signature) {
      throw new BadRequestException('Missing transaction signature');
    }
    const paymasterTxData = await this.paymasterServer.getCachedTxData(paymasterTx);
    const innerTx = TransactionUtils.convertObjectToTransaction(paymasterTx);

    const relayedTxV2 = await this.buildRelayedTx(innerTx, paymasterTxData.gasLimit);
    try {

      const transaction = await this.signAndBroadcastTransaction(relayedTxV2);
      if (!transaction) {
        throw new Error(`Broadcast failed for tx ${relayedTxV2}`);
      }

      return transaction;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Could not broadcast relayed transaction');
    }
  }

  async signAndBroadcastTransaction(transaction: Transaction, maxAttempts: number = 5): Promise<Transaction | undefined> {
    const lockKey = this.getBroadcastTxLockKey();

    let attempts = 0;
    while (attempts <= maxAttempts) {
      try {
        const lockAquired = await this.redlockService.tryLockResource(
          lockKey,
          this.configService.getRedlockConfiguration()
        );
        if (!lockAquired) {
          throw new Error('Could not acquire resource lock');
        }

        const nonce = await this.getNonce();
        transaction.setNonce(nonce);

        const relayerSignature = await this.signTx(transaction);
        transaction.applySignature(relayerSignature);

        const hash = await this.broadcastTransaction(transaction);
        this.logger.log(`Successful broadcast of transaction ${hash} with nonce ${transaction.getNonce().valueOf()}`);

        await this.incrementNonce(nonce);

        return transaction;
      } catch (error: any) {
        attempts++;
        this.logger.warn(`Broadcast attempt ${attempts} for ${transaction.getHash().hex()} failed: ${error}`);

        if (error.inner?.response?.data?.message &&
          this.isNonceTransactionError(error.inner.response.data.message)) {
          this.logger.warn(`Transaction broadcast failed due to a stale nonce. Deleting cached value.`);
          await this.clearCachedNonce();
        }
      } finally {
        await this.redlockService.release(lockKey);
      }
    }

    return;
  }

  async buildRelayedTx(innerTx: Transaction, gasLimit: number) {
    const networkConfig = await this.getNetworkConfig();
    const builder = new RelayedTransactionV2Builder();

    try {
      const relayedTxV2 = builder
        .setInnerTransaction(innerTx)
        .setInnerTransactionGasLimit(gasLimit)
        .setNetworkConfig(networkConfig)
        .setRelayerAddress(new Address(this.relayerAddress))
        .build();
      return relayedTxV2;
    } catch (error) {
      this.logger.error(error);

      throw new BadRequestException('Failed to build relayed transaction');
    }
  }

  async signTx(transaction: Transaction): Promise<Buffer> {
    if (!this.relayerSigner) {
      await this.loadWallet();
    }

    const serializedTransaction = transaction.serializeForSigning();
    return await this.relayerSigner.sign(serializedTransaction);
  }

  async loadWallet(): Promise<void> {
    try {
      const pemText = await promises.readFile(
        this.configService.getRelayerPEMFilePath(),
        { encoding: "utf8" }
      );
      this.relayerSigner = UserSigner.fromPem(pemText);
    } catch (error) {
      throw new BadRequestException('Relayer wallet is not set up');
    }
  }

  async broadcastTransaction(transaction: Transaction): Promise<string> {
    try {
      const hash = await this.networkProvider.sendTransaction(transaction);
      return hash;
    } catch (error) {
      this.logger.warn(`Broadcast attempt failed: ${error}`);
      throw error;
    }
  }

  async getNonce(maxAttempts: number = 5): Promise<number> {
    const redisNonce = await this.redisCacheService.get<number>(CacheInfo.RelayerNonce(this.relayerAddress).key);
    if (typeof redisNonce !== 'undefined') {
      return redisNonce;
    }

    let attempts = 0;
    while (attempts <= maxAttempts) {
      try {
        const nonce = await this.getNonceRaw(this.relayerAddress);

        await this.redisCacheService.set(
          CacheInfo.RelayerNonce(this.relayerAddress).key,
          nonce,
          CacheInfo.RelayerNonce(this.relayerAddress).ttl
        );

        return nonce;
      } catch (error) {
        attempts++;
        this.logger.warn(`Attempt ${attempts} for getNonce failed: ${error}`);
      }
    }

    throw new Error('Could not fetch account nonce');
  }

  async getNonceRaw(address: string): Promise<number> {
    const account = await this.networkProvider.getAccount(new Address(address));

    if (!account) {
      throw new Error('Could not fetch account data');
    }

    return account.nonce;
  }

  async incrementNonce(currentNonce: number): Promise<number | undefined> {
    try {
      const incrementedNonce = await this.redisCacheService.increment(
        CacheInfo.RelayerNonce(this.relayerAddress).key,
        CacheInfo.RelayerNonce(this.relayerAddress).ttl
      );

      if (currentNonce > 0 && incrementedNonce === 1) {
        await this.clearCachedNonce();
        return;
      }

      return incrementedNonce;
    } catch (error) {
      return;
    }
  }

  async clearCachedNonce(): Promise<void> {
    return await this.redisCacheService.delete(CacheInfo.RelayerNonce(this.relayerAddress).key);
  }

  getBroadcastTxLockKey(): string {
    const relayerAddress = this.configService.getRelayerAddress();
    return `broadcastRelayerTransaction:${relayerAddress}`;
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

  private isNonceTransactionError(error: string): boolean {
    return typeof error === 'string' && (error.includes('lowerNonceInTx: true') || error.includes('veryHighNonceInTx: true'));
  }
}
