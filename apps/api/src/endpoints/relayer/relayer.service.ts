import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionDetails } from "../paymaster/entities/transaction.details";
import { Address, RelayedTransactionV2Builder, Transaction } from "@multiversx/sdk-core/out";
import { TransactionUtils } from "../paymaster/transaction.utils";
import { ApiConfigService, CacheInfo } from "@mvx-monorepo/common";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers/out";
import { promises } from "fs";
import { UserSigner } from "@multiversx/sdk-wallet/out";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { Constants, OriginLogger } from "@multiversx/sdk-nestjs-common";
import { PaymasterService } from "../paymaster/paymaster.service";

@Injectable()
export class RelayerService {
  private readonly logger = new OriginLogger(RelayerService.name);
  private readonly networkProvider: ApiNetworkProvider;
  private relayerSigner!: UserSigner;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly paymasterServer: PaymasterService,
    private readonly cacheService: CacheService,
  ) {
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
  }

  async generateRelayedTx(paymasterTx: TransactionDetails): Promise<Transaction> {
    if (!paymasterTx.signature) {
      throw new BadRequestException('Missing transaction signature');
    }
    const paymasterTxData = await this.paymasterServer.getCachedTxData(paymasterTx);

    const innerTx = TransactionUtils.convertObjectToTransaction(paymasterTx);

    const relayerAddress = this.configService.getRelayerAddress();
    const relayerNonce = await this.getNonce(relayerAddress);

    const relayedTxV2 = await this.buildRelayedTx(innerTx, paymasterTxData.gasLimit, relayerNonce);
    const relayerSignature = await this.signRelayedTx(relayedTxV2);

    relayedTxV2.applySignature(relayerSignature);

    return relayedTxV2;
  }

  async buildRelayedTx(innerTx: Transaction, gasLimit: number, nonce: number) {
    const networkConfig = await this.networkProvider.getNetworkConfig();
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

  async getNonce(address: string): Promise<number> {
    return await this.cacheService.getOrSet(
      CacheInfo.AccountNonce(address).key,
      async () => await this.getNonceRaw(address),
      CacheInfo.AccountNonce(address).ttl,
      Constants.oneSecond()
    );
  }

  async getNonceRaw(address: string): Promise<number> {
    const account = await this.networkProvider.getAccount(new Address(address));
    return account.nonce;
  }
}
