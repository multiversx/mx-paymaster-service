import { Locker } from "@multiversx/sdk-nestjs-common";
import { Injectable, Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { SwapService } from "./swap.service";
import { Transaction } from "@multiversx/sdk-core/out";
import { CronJob } from "cron";
import { ApiConfigService } from "@mvx-monorepo/common";

@Injectable()
export class RelayerMonitoringService {
  private readonly logger: Logger;

  constructor(
    private readonly swapService: SwapService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly apiConfigService: ApiConfigService,
  ) {
    this.logger = new Logger(RelayerMonitoringService.name);

    const handleAutoSwapsCronJob = new CronJob(this.apiConfigService.getAutoSwapCronSchedule(), async () => await this.handleAutoSwaps());
    this.schedulerRegistry.addCronJob(this.handleAutoSwaps.name, handleAutoSwapsCronJob);
    handleAutoSwapsCronJob.start();
  }

  async handleAutoSwaps() {
    await Locker.lock('autoSwap', async () => {
      try {
        const tokensToBeSwapped = await this.swapService.getSwappableTokens();
        if (tokensToBeSwapped.length === 0) {
          await this.swapService.executeUnwrap();

          return;
        }

        const swapPromises = tokensToBeSwapped.map(token => this.swapService.generateSwapTx(token));
        const swapTxs = await Promise.all(swapPromises);

        const successfulTxs = swapTxs.filter((tx: Transaction | undefined) => tx) as Transaction[];

        const confirmationPromises = successfulTxs.map(elem => this.swapService.confirmTxSettled(elem));
        await Promise.all(confirmationPromises);

        await this.swapService.executeUnwrap();

        this.logger.log('End autoswap sequence');
      } catch (error) {
        this.logger.error(error);
      }
    });
  }
}
