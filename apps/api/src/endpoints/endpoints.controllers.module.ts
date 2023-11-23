import { Module } from "@nestjs/common";
import { DynamicModuleUtils } from "@mvx-monorepo/common";
import { EndpointsServicesModule } from "./endpoints.services.module";
import { HealthCheckController } from "@mvx-monorepo/common";
import { TokenController } from "./tokens/token.controller";
import { PaymasterController } from "./paymaster/paymaster.controller";
import { RelayerController } from "./relayer/relayer.controller";
import { AdminController } from "./admin/admin.controller";
import { DrainProtectionService } from "../drain-protection/drain.protection.service";

@Module({
  imports: [
    EndpointsServicesModule,
  ],
  providers: [
    DynamicModuleUtils.getNestJsApiConfigService(),
    DrainProtectionService,
  ],
  controllers: [
    HealthCheckController,
    RelayerController,
    PaymasterController,
    TokenController,
    AdminController,
  ],
})
export class EndpointsControllersModule { }
