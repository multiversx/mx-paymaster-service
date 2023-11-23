import { Module } from "@nestjs/common";
import { RelayerService } from "./relayer.service";
import { PaymasterService } from "../paymaster/paymaster.service";
import { TokenModule } from "../tokens/token.module";
import { DynamicModuleUtils } from "@mvx-monorepo/common";
import configuration from '../../../config/configuration';
import { RedlockModule } from "@mvx-monorepo/common/redlock";
import { SignerUtils } from "../../utils/signer.utils";
import { ApiService } from "../../common/api/api.service";
import { DrainProtectionService } from "../../drain-protection/drain.protection.service";

@Module({
  imports: [
    TokenModule,
    DynamicModuleUtils.getRedisModule(configuration),
    RedlockModule.register(configuration),
  ],
  providers: [
    PaymasterService,
    RelayerService,
    SignerUtils,
    ApiService,
    DrainProtectionService,
  ],
  exports: [RelayerService],
})
export class RelayerModule { }
