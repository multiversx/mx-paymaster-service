import { Module } from "@nestjs/common";
import { DynamicModuleUtils } from "@mvx-monorepo/common";
import { EndpointsServicesModule } from "./endpoints.services.module";
import { HealthCheckController } from "@mvx-monorepo/common";
import { TokenController } from "./tokens/token.controller";
import { PaymasterController } from "./paymaster/paymaster.controller";
import { RelayerController } from "./relayer/relayer.controller";

@Module({
  imports: [
    EndpointsServicesModule,
  ],
  providers: [
    DynamicModuleUtils.getNestJsApiConfigService(),
  ],
  controllers: [
    HealthCheckController,
    RelayerController,
    PaymasterController,
    TokenController,
  ],
})
export class EndpointsControllersModule { }
