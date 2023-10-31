import { Module } from "@nestjs/common";
import { TestSocketModule } from "./test-sockets/test.socket.module";
import { TokenModule } from "./tokens/token.module";
import { TransactionModule } from "./transactions/transaction.module";

@Module({
  imports: [
    TestSocketModule,
    TokenModule,
    TransactionModule,
  ],
  exports: [
    TestSocketModule, TokenModule, TransactionModule,
  ],
})
export class EndpointsServicesModule { }
