import { Locker } from "@multiversx/sdk-nestjs-common";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SwapService } from "./swap.service";
import { TokenSwap } from "./entities/token.swap";
import { RelayerService } from "../endpoints/relayer/relayer.service";
import { Transaction } from "@multiversx/sdk-core/out";

@Injectable()
export class RelayerMonitoringService {
  private readonly logger: Logger;

  constructor(
    private readonly swapService: SwapService,
    private readonly relayerService: RelayerService
  ) {
    this.logger = new Logger(RelayerMonitoringService.name);
  }

  @Cron('*/10 * * * * *')
  async handleAutoSwaps() {
    await Locker.lock('autoSwap', async () => {
      try {
        const tokensToBeSwapped = await this.swapService.getSwappableTokens();
        if (tokensToBeSwapped.length === 0) {
          return;
        }

        let nonce = await this.relayerService.getNonce();
        const successfulTxs: Transaction[] = [];

        const reduceSwapTxs = async (previous: any, tokenSwap: TokenSwap) => {
          const previousResult = await previous;
          if (!previousResult.error) {
            nonce = await this.relayerService.getNonce();
          }
          try {
            const result = await this.swapService.buildAndBroadcastSwapTx(tokenSwap, nonce);
            successfulTxs.push(result);

            return {
              error: false,
            };
          } catch (error) {
            console.log('got error - will not increment nonce');
            return {
              error: true,
              nonce: nonce,
            };
          }
        };
        const result = await tokensToBeSwapped.reduce(reduceSwapTxs, Promise.resolve({
          error: true,
          nonce: null,
        }));

        if (result.error) {
          console.log(`Unused nonce ${result.nonce} - needs gap TX`);
        }

        const confirmationPromises = successfulTxs.map(elem => this.swapService.confirmTxSettled(elem));
        await Promise.all(confirmationPromises);

        console.log('Stop autoswap sequence');
      } catch (error) {
        this.logger.error(error);
      }
    });
  }
}
