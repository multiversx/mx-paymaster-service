import { Module } from "@nestjs/common";
import { TestSocketModule } from "./test-sockets/test.socket.module";
import { TokenModule } from "./tokens/token.module";
import { PaymasterModule } from "./paymaster/paymaster.module";
import { RelayerModule } from "./relayer/relayer.module";

@Module({
  imports: [
    TestSocketModule,
    TokenModule,
    PaymasterModule,
    RelayerModule,
  ],
  exports: [
    TestSocketModule, TokenModule, PaymasterModule, RelayerModule,
  ],
})
export class EndpointsServicesModule { }
