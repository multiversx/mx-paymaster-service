import { Module } from "@nestjs/common";
import { DrainProtectionService } from "./drain.protection.service";
import { ApiConfigModule, DynamicModuleUtils } from "@mvx-monorepo/common";
import configuration from '../../config/configuration';
import { ScheduleModule } from "@nestjs/schedule";
import { FailedTransactionsCron } from "./crons/failed.transactions.cron";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ApiConfigModule.forRoot(configuration),
    DynamicModuleUtils.getCachingModule(configuration),
  ],
  providers: [DrainProtectionService, FailedTransactionsCron],
  exports: [DrainProtectionService, FailedTransactionsCron],
})
export class DrainProtectionModule { }
