import { Locker } from "@multiversx/sdk-nestjs-common";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers/out";
import { ApiConfigService } from "@mvx-monorepo/common";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { TokenConfig } from "../endpoints/tokens/entities/token.config";
import { TokenService } from "../endpoints/tokens/token.service";

@Injectable()
export class RelayerMonitoringService {
  private readonly networkProvider: ApiNetworkProvider;
  private readonly logger: Logger;
  private readonly tokens: TokenConfig[];

  constructor(
    private readonly configService: ApiConfigService,
    private readonly tokenService: TokenService,
  ) {
    this.logger = new Logger(RelayerMonitoringService.name);

    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
    this.tokens = this.tokenService.findAll();
  }

  @Cron('*/20 * * * * *')
  async handleAutoSwaps() {
    await Locker.lock('autoSwapBalanceCheck', async () => {
      const tokensToBeSwapped = this.tokens.filter(
        (token) => !token.swapContract || !token.swapMinAmount || !token.swapParameters
      );
      const tokenIdentifiers = tokensToBeSwapped.map(elem => elem.identifier).toString();
      const relayerAddress = this.configService.getRelayerAddress();

      console.log(tokenIdentifiers);
      const url = `accounts/${relayerAddress}/tokens?identifiers=${tokenIdentifiers}`;

      try {
        const accountTokens = await this.networkProvider.doGetGeneric(url);

        console.log(accountTokens);
      } catch (error) {
        this.logger.error(error);
        throw new Error('Account balance fetch request failed.');
      }
    }, true);
  }
}
