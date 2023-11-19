import { Module } from "@nestjs/common";
import { PaymasterService } from "./paymaster.service";
import { TokenModule } from "../tokens/token.module";
import { SignerUtils } from "../../utils/signer.utils";
import { ApiService } from "../../common/api/api.service";

@Module({
  imports: [
    TokenModule,
  ],
  providers: [
    PaymasterService,
    SignerUtils,
    ApiService,
  ],
  exports: [PaymasterService],
})
export class PaymasterModule { }
