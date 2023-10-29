import { Module } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { DynamicModuleUtils } from "@mvx-monorepo/common";
import configuration from "apps/api/config/configuration";

@Module({
  imports: [
    DynamicModuleUtils.getApiModule(configuration),
  ],
  providers: [
    TransactionService,
  ],
  exports: [TransactionService],
})
export class TransactionModule { }
