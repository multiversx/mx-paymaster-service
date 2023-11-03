import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { RelayerMonitoringService } from "./relayer.monitoring.service";
import configuration from '../../config/configuration';
import { ApiConfigModule, DynamicModuleUtils } from "@mvx-monorepo/common";
import { TokenModule } from "../endpoints/tokens/token.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ApiConfigModule.forRoot(configuration),
    DynamicModuleUtils.getCachingModule(configuration),
    TokenModule,
  ],
  providers: [
    RelayerMonitoringService,
  ],
  exports: [
    RelayerMonitoringService,
  ],
})
export class SwapModule { }
