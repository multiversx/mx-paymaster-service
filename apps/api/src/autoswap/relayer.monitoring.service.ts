import { Locker } from "@multiversx/sdk-nestjs-common";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SwapService } from "./swap.service";
import { TokenSwap } from "./entities/token.swap";

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

        const reduceSwapTxs = async (previous: any, tokenSwap: TokenSwap) => {
          await previous;
          return this.swapService.buildAndBroadcastSwapTx(tokenSwap);
        };
        tokensToBeSwapped.reduce(reduceSwapTxs, Promise.resolve());

      } catch (error) {
        this.logger.error(error);
      }
    });
  }
}
