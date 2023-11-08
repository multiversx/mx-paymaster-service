import { Module } from "@nestjs/common";
import { RelayerService } from "./relayer.service";
import { PaymasterService } from "../paymaster/paymaster.service";
import { TokenModule } from "../tokens/token.module";
import { RedlockModule } from "@mvx-monorepo/common/redlock";
import configuration from '../../../config/configuration';
import { DynamicModuleUtils } from "@mvx-monorepo/common";

@Module({
  imports: [
    TokenModule,
    RedlockModule.register(configuration),
    DynamicModuleUtils.getRedisModule(configuration),
  ],
  providers: [
    PaymasterService,
    RelayerService,
  ],
  exports: [RelayerService],
})
export class RelayerModule { }
