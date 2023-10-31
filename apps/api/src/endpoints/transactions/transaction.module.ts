import { Module } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { TokenModule } from "../tokens/token.module";

@Module({
  imports: [
    TokenModule,
  ],
  providers: [
    TransactionService,
  ],
  exports: [TransactionService],
})
export class TransactionModule { }
