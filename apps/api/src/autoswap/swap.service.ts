import { ApiNetworkProvider, NetworkConfig } from "@multiversx/sdk-network-providers/out";
import { ApiConfigService } from "@mvx-monorepo/common";
import { Injectable, Logger } from "@nestjs/common";
import { TokenConfig } from "../endpoints/tokens/entities/token.config";
import { TokenService } from "../endpoints/tokens/token.service";
import BigNumber from "bignumber.js";
import { TokenSwap } from "./entities/token.swap";
import { Address, Transaction, TransactionPayload, TransactionWatcher } from "@multiversx/sdk-core/out";
import { RelayerService } from "../endpoints/relayer/relayer.service";
import { TransactionUtils } from "../endpoints/paymaster/transaction.utils";

@Injectable()
export class SwapService {
  private readonly networkProvider: ApiNetworkProvider;
  private readonly logger: Logger;
  private readonly tokens: TokenConfig[];
  private networkConfig!: NetworkConfig;
  private transactionWatcher!: TransactionWatcher;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly tokenService: TokenService,
    private readonly relayerService: RelayerService
  ) {
    this.logger = new Logger(SwapService.name);

    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
    this.tokens = this.tokenService.findAll();
  }

  async getSwappableTokens(): Promise<TokenSwap[]> {
    const tokensToBeSwapped = this.tokens.filter(
      token => token.swapContract && token.swapMinAmount && token.swapParameters && token.swapGasLimit
    );
    const tokenIdentifiers = tokensToBeSwapped.map(elem => elem.identifier).toString();
    const relayerAddress = this.configService.getRelayerAddress();

    const url = `accounts/${relayerAddress}/tokens?identifiers=${tokenIdentifiers}`;

    try {
      const accountTokens = await this.networkProvider.doGetGeneric(url);

      return accountTokens.filter((elem: any) => {
        const currentToken = tokensToBeSwapped.find((token) => elem.identifier === token.identifier);
        const swapThreshold = BigNumber(currentToken?.swapMinAmount ?? 0);

        return BigNumber(elem.balance).gte(swapThreshold);
      }).map((elem: any) => {
        const currentToken = tokensToBeSwapped.find((token) => elem.identifier === token.identifier);
        return {
          identifier: elem.identifier,
          swapContract: currentToken?.swapContract,
          swapParameters: currentToken?.swapParameters,
          swapGasLimit: currentToken?.swapGasLimit,
          amount: elem.balance,
        };
      });
    } catch (error) {
      this.logger.error(error);
      throw new Error('Fetch relayer token balance fetch request failed.');
    }
  }

  async buildAndBroadcastSwapTx(swapParams: TokenSwap): Promise<string> {
    this.logger.log(`Start swap sequence for token ${swapParams.identifier}`);

    const relayerAddress = this.configService.getRelayerAddress();
    const networkConfig = await this.getNetworkConfig();
    const watcher = this.getTransactionWatcher();

    const payload = `ESDTTransfer@${swapParams.identifier}@${swapParams.amount}@${swapParams.swapParameters}`;
    const nonce = await this.relayerService.getNonce(relayerAddress);

    const transaction = new Transaction({
      nonce: nonce,
      receiver: new Address(swapParams.swapContract),
      sender: new Address(relayerAddress),
      chainID: networkConfig.ChainID,
      gasLimit: swapParams.swapGasLimit,
      gasPrice: 1000000000,
      data: TransactionPayload.fromEncoded(TransactionUtils.encodeTransactionData(payload)),
    });

    const relayerSignature = await this.relayerService.signRelayedTx(transaction);
    transaction.applySignature(relayerSignature);

    try {
      await this.networkProvider.sendTransaction(transaction);
    } catch (error) {
      this.logger.error(`Swap failed for token ${swapParams.identifier}`);
      this.logger.error(error);
      // throw new Error(`Swap failed for token ${swapParams.identifier}`);
      return '';
    }

    const txOnNetwork = await watcher.awaitCompleted(transaction);
    this.logger.log(`Successfully swapped ${swapParams.identifier} in tx ${txOnNetwork.hash}`);
    return txOnNetwork.hash;
  }

  async getNetworkConfig(): Promise<NetworkConfig> {
    if (!this.networkConfig) {
      this.networkConfig = await this.networkProvider.getNetworkConfig();
    }

    return this.networkConfig;
  }

  getTransactionWatcher(): TransactionWatcher {
    if (!this.transactionWatcher) {
      this.transactionWatcher = new TransactionWatcher(this.networkProvider);
    }

    return this.transactionWatcher;
  }
}
