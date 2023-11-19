import { Module } from "@nestjs/common";
import { PaymasterService } from "./paymaster.service";
import { TokenModule } from "../tokens/token.module";
import { SignerUtils } from "../../utils/signer.utils";

@Module({
  imports: [
    TokenModule,
  ],
  providers: [
    PaymasterService,
    SignerUtils,
  ],
  exports: [PaymasterService],
})
export class PaymasterModule { }
