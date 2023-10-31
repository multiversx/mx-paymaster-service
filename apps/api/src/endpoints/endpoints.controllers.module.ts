import { Module } from "@nestjs/common";
import { DynamicModuleUtils } from "@mvx-monorepo/common";
import { EndpointsServicesModule } from "./endpoints.services.module";
import { HealthCheckController } from "@mvx-monorepo/common";
import { TokenController } from "./tokens/token.controller";
import { TransactionController } from "./transactions/transaction.controller";
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
    TokenController,
    TransactionController,
  ],
})
export class EndpointsControllersModule { }
