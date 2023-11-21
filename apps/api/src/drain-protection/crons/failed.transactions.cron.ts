import { Locker } from "@multiversx/sdk-nestjs-common";
import { Injectable, Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { DrainProtectionService } from "../drain.protection.service";
import { CronJob } from "cron";
import { ApiConfigService } from "@mvx-monorepo/common";

@Injectable()
export class FailedTransactionsCron {
  private readonly logger: Logger;

  constructor(
    private readonly drainProtectionService: DrainProtectionService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly apiConfigService: ApiConfigService,
  ) {
    this.logger = new Logger(FailedTransactionsCron.name);

    const handleTxStatusCheckCronJob = new CronJob(
      this.apiConfigService.getDrainProtectionCronSchedule(),
      async () => await this.handleTransactionStatusCheck()
    );

    this.schedulerRegistry.addCronJob(this.handleTransactionStatusCheck.name, handleTxStatusCheckCronJob);

    handleTxStatusCheckCronJob.start();
  }

  async handleTransactionStatusCheck(): Promise<void> {
    await Locker.lock('checkTxsStatus', async () => {
      try {
        const getRecentBroadcastedTxs = await this.drainProtectionService.getRecentBroadcastedTransactions();
        if (getRecentBroadcastedTxs === 0) {
          return;
        }

        const lastCheckTimestamp = await this.drainProtectionService.getLastCheckTimestamp();
        await this.drainProtectionService.updateCheckTimestamp();

        const failedTransactions = await this.drainProtectionService.getLatestFailedTransactions(lastCheckTimestamp);
        if (failedTransactions.length === 0) {
          return;
        }

        await this.drainProtectionService.processFailedTransactions(failedTransactions);

        this.logger.log(`Processed ${failedTransactions.length} failed transactions.`);
      } catch (error) {
        this.logger.error(error);
      }
    });
  }
}
