import { Module } from "@nestjs/common";
import { RelayerService } from "./relayer.service";
import { PaymasterService } from "../paymaster/paymaster.service";
import { TokenModule } from "../tokens/token.module";

@Module({
  imports: [
    TokenModule,
  ],
  providers: [
    PaymasterService,
    RelayerService,
  ],
  exports: [RelayerService],
})
export class RelayerModule { }
