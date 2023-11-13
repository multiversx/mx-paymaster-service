import { Module } from "@nestjs/common";
import { PaymasterService } from "./paymaster.service";
import { TokenModule } from "../tokens/token.module";

@Module({
  imports: [
    TokenModule,
  ],
  providers: [
    PaymasterService,
  ],
  exports: [PaymasterService],
})
export class PaymasterModule { }
