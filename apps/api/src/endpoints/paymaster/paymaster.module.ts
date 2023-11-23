import { Module } from "@nestjs/common";
import { PaymasterService } from "./paymaster.service";
import { TokenModule } from "../tokens/token.module";
import { SignerUtils } from "../../utils/signer.utils";
import { ApiService } from "../../common/api/api.service";
import { DrainProtectionService } from "../../drain-protection/drain.protection.service";

@Module({
  imports: [
    TokenModule,
  ],
  providers: [
    PaymasterService,
    SignerUtils,
    ApiService,
    DrainProtectionService,
  ],
  exports: [PaymasterService],
})
export class PaymasterModule { }
