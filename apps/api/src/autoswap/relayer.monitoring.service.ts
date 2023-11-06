import { Locker } from "@multiversx/sdk-nestjs-common";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SwapService } from "./swap.service";

@Injectable()
export class RelayerMonitoringService {
  private readonly logger: Logger;

  constructor(
    private readonly swapService: SwapService
  ) {
    this.logger = new Logger(RelayerMonitoringService.name);
    // this.cronSchedule = this.configService.getAutoSwapCronSchedule();
  }

  @Cron('*/20 * * * * *')
  async handleAutoSwaps() {
    await Locker.lock('autoSwap', async () => {
      try {
        const tokensToBeSwapped = await this.swapService.getSwappableTokens();
        if (tokensToBeSwapped.length === 0) {
          return;
        }

        const swapPromises = tokensToBeSwapped.map((tokenSwap) => {
          return this.swapService.executeSwapTx(tokenSwap);
        });

        for (const swapPromise of swapPromises) {
          try {
            const swapTransaction = await swapPromise;
            this.logger.log(`Swap completed in transaction ${swapTransaction.hash}`);
          } catch (error) {
            this.logger.error(error);
          }
        }

      } catch (error) {
        this.logger.error(error);
      }
    }, true);
  }
}
