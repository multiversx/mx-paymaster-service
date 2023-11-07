import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionDetails } from "../paymaster/entities/transaction.details";
import { Address, RelayedTransactionV2Builder, Transaction } from "@multiversx/sdk-core/out";
import { TransactionUtils } from "../paymaster/transaction.utils";
import { ApiConfigService } from "@mvx-monorepo/common";
import { ApiNetworkProvider, NetworkConfig } from "@multiversx/sdk-network-providers/out";
import { promises } from "fs";
import { UserSigner } from "@multiversx/sdk-wallet/out";
import { OriginLogger } from "@multiversx/sdk-nestjs-common";
import { PaymasterService } from "../paymaster/paymaster.service";

@Injectable()
export class RelayerService {
  private readonly logger = new OriginLogger(RelayerService.name);
  private readonly networkProvider: ApiNetworkProvider;
  private relayerSigner!: UserSigner;
  private networkConfig: NetworkConfig | undefined = undefined;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly paymasterServer: PaymasterService,
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

  async getNonce(address: string): Promise<number> {
    const account = await this.networkProvider.getAccount(new Address(address));
    return account.nonce;
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
