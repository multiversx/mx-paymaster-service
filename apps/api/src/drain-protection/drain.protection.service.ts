import { Injectable, Logger } from "@nestjs/common";
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

  async processFailedTransactions(transactions: any): Promise<void> {
    const processTxPromises = transactions.map((tx: any) => this.processFailedTx(tx));
    await Promise.all(processTxPromises);
  }

  async processFailedTx(txDetails: { receiver: string, txHash: string, timestamp: number, nonce: number }): Promise<void> {
    this.logger.log(`Transaction ${txDetails.txHash} by ${txDetails.receiver} has status failed`);

    const failedTxsCounter = await this.incrementAddressFailedTxsCounter(txDetails.receiver);
    if (failedTxsCounter > this.configService.getDrainProtectionAddressMaxFailedTxs()) {
      await this.banAddress(txDetails.receiver);
    }

    const totalFailedLastHour = await this.incrementTotalFailedTxsCounter();
    if (totalFailedLastHour > this.configService.getDrainProtectionTotalMaxFailedTxs()) {
      await this.pauseRelaying();
    }
  }

  async banAddress(address: string): Promise<void> {
    await this.cachingService.setRemote(
      CacheInfo.BannedAddresses(address).key,
      true,
      CacheInfo.BannedAddresses(address).ttl
    );
  }

  async removeAddressBan(address: string): Promise<void> {
    await this.cachingService.deleteRemote(CacheInfo.BannedAddresses(address).key);
  }

  async pauseRelaying(): Promise<void> {
    await this.cachingService.setRemote(
      CacheInfo.SystemPaused.key,
      true,
      CacheInfo.SystemPaused.ttl
    );
  }

  async resumeRelaying(): Promise<void> {
    await this.cachingService.deleteRemote(CacheInfo.SystemPaused.key);
  }

  async isAddressBanned(address: string): Promise<boolean> {
    const addressIsBanned = await this.cachingService.getRemote<boolean>(CacheInfo.BannedAddresses(address).key);
    return addressIsBanned ?? false;
  }

  async isSystemPaused(): Promise<boolean> {
    const isPaused = await this.cachingService.getRemote<boolean>(CacheInfo.SystemPaused.key);
    return isPaused ?? false;
  }

  async getLastCheckTimestamp(): Promise<number> {
    return await this.cachingService.getOrSetRemote(
      CacheInfo.StatusCheckTimestamp.key,
      async () => await this.getOneMinuteAgoTimestamp(),
      CacheInfo.StatusCheckTimestamp.ttl,
    );
  }

  async updateCheckTimestamp(): Promise<void> {
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
    try {
      return await this.networkProvider.doGetGeneric(url);
    } catch (error) {
      this.logger.log(`getLatestFailedTransactions request failed with error ${error}`);
      return [];
    }
  }

  async incrementAddressFailedTxsCounter(address: string): Promise<number> {
    const intervalInMinutes = this.configService.getDrainProtectionAddressInterval();
    const { startOfCurrentInterval, ttl } = this.calculateIntervalStartAndTtl(intervalInMinutes);

    return await this.cachingService.incrementRemote(
      CacheInfo.AddressFailedTxs(address, startOfCurrentInterval.toString()).key,
      ttl
    );
  }

  async incrementTotalFailedTxsCounter(): Promise<number> {
    const intervalInMinutes = this.configService.getDrainProtectionTotalInterval();
    const { startOfCurrentInterval, ttl } = this.calculateIntervalStartAndTtl(intervalInMinutes);

    return await this.cachingService.incrementRemote(
      CacheInfo.TotalFailedTxs(startOfCurrentInterval).key,
      ttl
    );
  }

  private calculateIntervalStartAndTtl(intervalInMinutes: number): { startOfCurrentInterval: string, ttl: number } {
    const currentTime = new Date();
    const intervalInMillis = intervalInMinutes * 60 * 1000; // Convert interval to milliseconds
    const currentTimestamp = currentTime.getTime();

    // Calculate the start of the current interval
    const startOfCurrentInterval = currentTimestamp - (currentTimestamp % intervalInMillis);
    const startOfNextInterval = startOfCurrentInterval + intervalInMillis;

    // Calculate TTL as the time remaining until the end of the current interval
    const ttl = startOfNextInterval - currentTimestamp;

    return {
      startOfCurrentInterval: startOfCurrentInterval.toString(),
      ttl: Math.floor(ttl / 1000),
    };
  }
}
