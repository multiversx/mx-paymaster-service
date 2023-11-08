import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { RelayerMonitoringService } from "./relayer.monitoring.service";
import configuration from '../../config/configuration';
import { ApiConfigModule, DynamicModuleUtils } from "@mvx-monorepo/common";
import { TokenModule } from "../endpoints/tokens/token.module";
import { SwapService } from "./swap.service";
import { RelayerService } from "../endpoints/relayer/relayer.service";
import { RelayerModule } from "../endpoints/relayer/relayer.module";
import { PaymasterService } from "../endpoints/paymaster/paymaster.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ApiConfigModule.forRoot(configuration),
    DynamicModuleUtils.getCachingModule(configuration),
    DynamicModuleUtils.getRedisModule(configuration),
    TokenModule,
    RelayerModule,
  ],
  providers: [
    RelayerMonitoringService, SwapService, RelayerService, PaymasterService,
  ],
  exports: [
    RelayerMonitoringService, SwapService,
  ],
})
export class SwapModule { }
