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

  constructor(
    private readonly configService: ApiConfigService,
    private readonly paymasterServer: PaymasterService,
    private readonly redlockService: RedlockService,
    private readonly redisCacheService: RedisCacheService
  ) {
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
  }

  async generateRelayedTx(paymasterTx: TransactionDetails): Promise<Transaction> {
    if (!paymasterTx.signature) {
      throw new BadRequestException('Missing transaction signature');
    }
    const paymasterTxData = await this.paymasterServer.getCachedTxData(paymasterTx);
    const innerTx = TransactionUtils.convertObjectToTransaction(paymasterTx);

    const lockKey = this.getBroadcastTxLockKey();
    try {
      const lockAquired = await this.redlockService.tryLockResource(lockKey, this.configService.getRedlockConfiguration());
      if (!lockAquired) {
        this.logger.error('Could not acquire lock for generateRelayedTx');
        throw new InternalServerErrorException('Could not acquire lock for transaction broadcasting');
      }

      const relayerNonce = await this.getNonce();
      const relayedTxV2 = await this.buildRelayedTx(innerTx, paymasterTxData.gasLimit, relayerNonce);

      const relayerSignature = await this.signTx(relayedTxV2);
      relayedTxV2.applySignature(relayerSignature);

      const hash = await this.broadcastRelayedTx(relayedTxV2);
      if (!hash) {
        throw new InternalServerErrorException('Could not broadcast relayed transaction');
      }

      await this.incremenetNonce();
      this.logger.log(`Successful broadcast of relayed tx ${hash}`);
      return relayedTxV2;
    } finally {
      await this.redlockService.release(lockKey);
    }
  }

  async buildRelayedTx(innerTx: Transaction, gasLimit: number, nonce: number) {
    const networkConfig = await this.getNetworkConfig();
    const builder = new RelayedTransactionV2Builder();
    const relayerAddress = this.configService.getRelayerAddress();

    try {
      const relayedTxV2 = builder
        .setInnerTransaction(innerTx)
        .setInnerTransactionGasLimit(gasLimit)
        .setRelayerNonce(nonce)
        .setNetworkConfig(networkConfig)
        .setRelayerAddress(new Address(relayerAddress))
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

  async broadcastRelayedTx(transaction: Transaction, maxAttempts: number = 5): Promise<string | undefined> {
    let attempts = 0;
    while (attempts <= maxAttempts) {
      try {
        const hash = await this.networkProvider.sendTransaction(transaction);
        return hash;
      } catch (error) {
        attempts++;
        this.logger.warn(`Broadcast attempt ${attempts} failed: ${error}`);

        await this.sleep(300);
      }
    }

    return;
  }

  async getNonce(maxAttempts: number = 5): Promise<number> {
    let attempts = 0;
    const relayerAddress = this.configService.getRelayerAddress();

    while (attempts <= maxAttempts) {
      try {
        const nonce = await this.getNonceRaw(relayerAddress);
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

    const redisLock = await this.redisCacheService.setnx(
      CacheInfo.RelayerNonce(address).key,
      account.nonce
    );
    if (redisLock) {
      await this.redisCacheService.expire(
        CacheInfo.RelayerNonce(address).key,
        CacheInfo.RelayerNonce(address).ttl
      );
      return account.nonce;
    }

    const redisNonce = await this.redisCacheService.get<number>(CacheInfo.RelayerNonce(address).key);
    if (!redisNonce) {
      throw new Error('Stale nonce. Out of sync state');
    }

    if (account.nonce > redisNonce) {
      await this.redisCacheService.delete(CacheInfo.RelayerNonce(address).key);

      throw new Error('Stale nonce. Out of sync state');
    }

    return redisNonce;
  }

  async incremenetNonce(): Promise<number | undefined> {
    const relayerAddress = this.configService.getRelayerAddress();
    try {
      const redisNonce = await this.redisCacheService.get<number>(CacheInfo.RelayerNonce(relayerAddress).key);

      if (redisNonce) {
        return await this.redisCacheService.increment(CacheInfo.RelayerNonce(relayerAddress).key);
      }

      const account = await this.networkProvider.getAccount(new Address(relayerAddress));
      const incrementedNonce = account.nonce + 1;

      await this.redisCacheService.set(
        CacheInfo.RelayerNonce(relayerAddress).key,
        incrementedNonce,
        CacheInfo.RelayerNonce(relayerAddress).ttl
      );

      return incrementedNonce;
    } catch (error) {
      return;
    }
  }

  getBroadcastTxLockKey(): string {
    const relayerAddress = this.configService.getRelayerAddress();
    return `broadcastRelayerTransaction:${relayerAddress}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Number(ms)));
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
