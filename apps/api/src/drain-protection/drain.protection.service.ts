import { Locker } from "@multiversx/sdk-nestjs-common";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers/out";
import { ApiConfigService, CacheInfo } from "@mvx-monorepo/common";
import { CacheService } from "@multiversx/sdk-nestjs-cache";

@Injectable()
export class DrainProtectionService {
  private readonly logger: Logger;
  private readonly networkProvider: ApiNetworkProvider;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly cachingService: CacheService
  ) {
    this.logger = new Logger(DrainProtectionService.name);
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
  }

  @Cron('*/20 * * * * *')
  async handleTransactionStatusCheck() {
    await Locker.lock('checkTxsStatus', async () => {
      try {
        const lastCheckTimestamp = await this.getLastCheckTimestamp();
        await this.updateCheckTimestamp();

        const failedTransactions = await this.getLatestFailedTransactions(lastCheckTimestamp);
        if (failedTransactions.length === 0) {
          return;
        }

        const processTxPromises = failedTransactions.map((tx: any) => this.processFailedTx(tx));
        await Promise.all(processTxPromises);

      } catch (error) {
        this.logger.error(error);
      }
    });
  }

  async getLastCheckTimestamp() {
    return await this.cachingService.getOrSetRemote(
      CacheInfo.StatusCheckTimestamp.key,
      async () => await this.getOneMinuteAgoTimestamp(),
      CacheInfo.StatusCheckTimestamp.ttl,
    );
  }

  async updateCheckTimestamp() {
    await this.cachingService.setRemote(
      CacheInfo.StatusCheckTimestamp.key,
      this.getCurrentTimestamp(),
      CacheInfo.StatusCheckTimestamp.ttl
    );
  }

  async getOneMinuteAgoTimestamp(): Promise<number> {
    return await Promise.resolve(this.getCurrentTimestamp() - 172800);
  }

  getCurrentTimestamp(): number {
    const now = new Date().getTime();
    return Math.floor(now / 1000);
  }

  async getLatestFailedTransactions(timestamp: number) {
    const relayerAddress = this.configService.getRelayerAddress();
    let url = `accounts/${relayerAddress}/transactions?status=fail&after=${timestamp}`;
    url += `&function=forwardExecution&fields=receiver,timestamp,txHash,nonce`;

    const transactions = await this.networkProvider.doGetGeneric(url);

    return transactions;
  }

  async processFailedTx(txDetails: { receiver: string, txHash: string, timestamp: number, nonce: number }) {
    this.logger.log(`Transaction ${txDetails.txHash} by ${txDetails.receiver} has status failed`);

    await this.incrementAddressFailedTxsCounter(txDetails.receiver);
    await this.incrementTotalFailedTxsCounter();
  }

  async incrementAddressFailedTxsCounter(address: string) {
    const currentHour = new Date().getHours().toString();
    const currentMinutes = new Date().getMinutes();

    await this.cachingService.incrementRemote(
      CacheInfo.AddressFailedTxs(address, currentHour).key,
      3600 - currentMinutes * 60
    );
  }

  async incrementTotalFailedTxsCounter() {
    const now = new Date();
    const currentDay = now.getDate().toString();
    const endOfDay = new Date().setHours(23, 59, 59);
    const difference = endOfDay - now.getTime();

    await this.cachingService.incrementRemote(
      CacheInfo.TotalFailedTxs(currentDay).key,
      Math.floor(difference / 1000)
    );
  }
}
