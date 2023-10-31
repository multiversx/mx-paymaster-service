import { Module } from "@nestjs/common";
import { DynamicModuleUtils } from "@mvx-monorepo/common";
import { EndpointsServicesModule } from "./endpoints.services.module";
import { HealthCheckController } from "@mvx-monorepo/common";
import { TokenController } from "./tokens/token.controller";
import { TransactionController } from "./transactions/transaction.controller";

@Module({
  imports: [
    EndpointsServicesModule,
  ],
  providers: [
    DynamicModuleUtils.getNestJsApiConfigService(),
  ],
  controllers: [
    HealthCheckController,
    TokenController,
    TransactionController,
  ],
})
export class EndpointsControllersModule { }
