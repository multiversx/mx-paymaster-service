import { ApiConfigModule } from "@mvx-monorepo/common";
import { Global, Module } from "@nestjs/common";
import { ApiService } from "./api.service";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers/out";
import { SignerUtils } from "../../utils/signer.utils";

@Global()
@Module({
  imports: [
    ApiConfigModule,
  ],
  providers: [
    ApiService,
    ApiNetworkProvider,
    SignerUtils,
  ],
  exports: [
    ApiService,
  ],
})
export class ApiModule { }
