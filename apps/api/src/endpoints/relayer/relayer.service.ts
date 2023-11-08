import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionDetails } from "../paymaster/entities/transaction.details";
import { Address, RelayedTransactionV2Builder, Transaction } from "@multiversx/sdk-core/out";
import { TransactionUtils } from "../paymaster/transaction.utils";
import { ApiConfigService, CacheInfo } from "@mvx-monorepo/common";
import { ApiNetworkProvider, NetworkConfig } from "@multiversx/sdk-network-providers/out";
import { promises } from "fs";
import { UserSigner } from "@multiversx/sdk-wallet/out";
import { OriginLogger } from "@multiversx/sdk-nestjs-common";
import { PaymasterService } from "../paymaster/paymaster.service";
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
    private readonly redisCacheService: RedisCacheService,
  ) {
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
  }

  async generateRelayedTx(paymasterTx: TransactionDetails): Promise<Transaction> {
    if (!paymasterTx.signature) {
      throw new BadRequestException('Missing transaction signature');
    }
    const paymasterTxData = await this.paymasterServer.getCachedTxData(paymasterTx);

    const innerTx = TransactionUtils.convertObjectToTransaction(paymasterTx);

    const relayerNonce = await this.getNonce();
    const relayedTxV2 = await this.buildRelayedTx(innerTx, paymasterTxData.gasLimit, relayerNonce);
    const relayerSignature = await this.signRelayedTx(relayedTxV2);

    relayedTxV2.applySignature(relayerSignature);

    return relayedTxV2;
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

  // todo: rename to signTx
  async signRelayedTx(transaction: Transaction): Promise<Buffer> {
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

  async broadcastRelayedTx(transaction: Transaction): Promise<string> {
    const txHash = await this.networkProvider.sendTransaction(transaction);
    return txHash;
  }

  async getNonce(): Promise<number> {
    let attempts = 0;
    const MAX_ATTEMPTS = 5;
    const relayerAddress = this.configService.getRelayerAddress();

    while (attempts <= MAX_ATTEMPTS) {
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

    const redisLock = await this.redisCacheService.setnx(CacheInfo.RelayerNonce.key, account.nonce);

    if (redisLock) {
      await this.redisCacheService.expire(CacheInfo.RelayerNonce.key, CacheInfo.RelayerNonce.ttl);
      return account.nonce;
    }

    const newNonce = await this.redisCacheService.increment(CacheInfo.RelayerNonce.key);
    if (account.nonce > newNonce) {
      await this.redisCacheService.delete(CacheInfo.RelayerNonce.key);

      throw new Error('Stale nonce. Out of sync state');
    }

    return newNonce;
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
