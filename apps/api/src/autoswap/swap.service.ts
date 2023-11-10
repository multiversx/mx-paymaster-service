import { ApiNetworkProvider, NetworkConfig } from "@multiversx/sdk-network-providers/out";
import { ApiConfigService } from "@mvx-monorepo/common";
import { Injectable, Logger } from "@nestjs/common";
import { TokenConfig } from "../endpoints/tokens/entities/token.config";
import { TokenService } from "../endpoints/tokens/token.service";
import BigNumber from "bignumber.js";
import { TokenSwap } from "./entities/token.swap";
import { Address, ITransactionOnNetwork, Transaction, TransactionPayload, TransactionWatcher } from "@multiversx/sdk-core/out";
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
    private readonly relayerService: RelayerService,
  ) {
    this.logger = new Logger(SwapService.name);

    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
    this.tokens = this.tokenService.findAll();
  }

  async getSwappableTokens(): Promise<TokenSwap[]> {
    const wrappedEgldIdentifier = this.configService.getWrappedEGLDIdentifier();

    const tokensToBeSwapped = this.tokens.filter(token =>
      token.identifier !== wrappedEgldIdentifier &&
      token.swapContract && token.swapMinAmount &&
      token.swapParameters && token.swapGasLimit
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
      this.logger.error(`Get relayer token balance request failed with error: ${error}`);
      throw new Error('Fetch relayer token balance request failed.');
    }
  }

  async getUnwrapSwap(): Promise<TokenSwap | undefined> {
    const wrappedEgldIdentifier = this.configService.getWrappedEGLDIdentifier();
    const wrappedEgld = this.tokens.find((token) => token.identifier === wrappedEgldIdentifier);

    if (!wrappedEgld || !wrappedEgld.swapContract || !wrappedEgld.swapMinAmount ||
      !wrappedEgld.swapGasLimit || !wrappedEgld.swapParameters) {
      return undefined;
    }

    const relayerAddress = this.configService.getRelayerAddress();
    const url = `accounts/${relayerAddress}/tokens/${wrappedEgldIdentifier}`;

    try {
      const accountWrappedEgld = await this.networkProvider.doGetGeneric(url);
      const swapThreshold = BigNumber(wrappedEgld.swapMinAmount ?? 0);

      if (BigNumber(accountWrappedEgld.balance).lt(swapThreshold)) {
        return undefined;
      }

      return {
        identifier: wrappedEgldIdentifier,
        swapContract: wrappedEgld.swapContract,
        swapParameters: wrappedEgld.swapParameters,
        swapGasLimit: wrappedEgld?.swapGasLimit,
        amount: accountWrappedEgld.balance,
      };
    } catch (error) {
      return;
    }
  }

  async executeUnwrap(): Promise<void | undefined> {
    const unwrapSwap = await this.getUnwrapSwap();
    if (!unwrapSwap) {
      return;
    }

    const unwrapTx = await this.generateSwapTx(unwrapSwap);
    if (!unwrapTx) {
      return;
    }

    await this.confirmTxSettled(unwrapTx);
  }

  async buildTransaction(tokenSwap: TokenSwap, nonce: number,): Promise<Transaction> {
    const networkConfig = await this.getNetworkConfig();
    const relayerAddress = this.configService.getRelayerAddress();

    const payload = `ESDTTransfer@${tokenSwap.identifier}@${tokenSwap.amount}@${tokenSwap.swapParameters}`;
    const transaction = new Transaction({
      nonce: nonce,
      receiver: new Address(tokenSwap.swapContract),
      value: '0',
      sender: new Address(relayerAddress),
      chainID: networkConfig.ChainID,
      gasLimit: tokenSwap.swapGasLimit,
      gasPrice: networkConfig.MinGasPrice,
      data: TransactionPayload.fromEncoded(TransactionUtils.encodeTransactionData(payload)),
    });

    return transaction;
  }

  async generateSwapTx(swapParams: TokenSwap): Promise<Transaction | undefined> {
    try {
      // 0 - dummy nonce
      const transaction = await this.buildTransaction(swapParams, 0);
      this.logger.log(
        `Start swap sequence for token ${swapParams.identifier}`
      );

      return await this.relayerService.signAndBroadcastTransaction(transaction);
    } catch (error) {
      this.logger.error(`Swap transaction for ${swapParams.identifier} failed with error: ${error}`);
      return;
    }
  }

  async confirmTxSettled(transaction: Transaction, maxAttempts: number = 10): Promise<ITransactionOnNetwork | undefined> {
    const watcher = this.getTransactionWatcher();
    let attempts = 0;

    while (attempts <= maxAttempts) {
      try {
        const txOnNetwork = await watcher.awaitCompleted(transaction);
        this.logger.log(`Swap confirmed for transaction ${txOnNetwork.hash}`);

        return txOnNetwork;
      } catch (error) {
        attempts++;
        this.logger.warn(`Confirmation attempt ${attempts} failed: ${error}`);

        await this.sleep(1000);
      }
    }

    this.logger.error(`Swap transaction ${transaction.getHash().hex()} could not be confirmed`);
    return;
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Number(ms)));
  }
}