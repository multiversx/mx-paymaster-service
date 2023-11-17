import { Module } from "@nestjs/common";
import { DrainProtectionService } from "./drain.protection.service";
import { ApiConfigModule, DynamicModuleUtils } from "@mvx-monorepo/common";
import configuration from '../../config/configuration';
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ApiConfigModule.forRoot(configuration),
    DynamicModuleUtils.getCachingModule(configuration),
  ],
  providers: [DrainProtectionService],
  exports: [DrainProtectionService],
})
export class DrainProtectionModule { }
