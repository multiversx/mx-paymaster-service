import { Module } from "@nestjs/common";
import { RelayerService } from "./relayer.service";
import { PaymasterService } from "../paymaster/paymaster.service";
import { TokenModule } from "../tokens/token.module";
import { DynamicModuleUtils } from "@mvx-monorepo/common";
import configuration from '../../../config/configuration';

@Module({
  imports: [
    TokenModule,
    DynamicModuleUtils.getRedisModule(configuration),
  ],
  providers: [
    PaymasterService,
    RelayerService,
  ],
  exports: [RelayerService],
})
export class RelayerModule { }
