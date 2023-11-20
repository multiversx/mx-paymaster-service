import { Locker } from "@multiversx/sdk-nestjs-common";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DrainProtectionService } from "../drain.protection.service";

@Injectable()
export class FailedTransactionsCron {
  private readonly logger: Logger;

  constructor(
    private readonly drainProtectionService: DrainProtectionService
  ) {
    this.logger = new Logger(FailedTransactionsCron.name);
  }

  @Cron('*/20 * * * * *')
  async handleTransactionStatusCheck(): Promise<void> {
    await Locker.lock('checkTxsStatus', async () => {
      try {
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
