import { Module } from "@nestjs/common";
import { ExampleModule } from "@mvx-monorepo/common";
import { TestSocketModule } from "./test-sockets/test.socket.module";
import { TokenModule } from "./tokens/token.module";
import { UsersModule } from "./users/user.module";
import configuration from "../../config/configuration";
import { TransactionModule } from "./transactions/transaction.module";

@Module({
  imports: [
    ExampleModule.forRoot(configuration),
    TestSocketModule,
    UsersModule,
    TokenModule,
    TransactionModule,
  ],
  exports: [
    ExampleModule, TestSocketModule, UsersModule, TokenModule, TransactionModule,
  ],
})
export class EndpointsServicesModule { }
