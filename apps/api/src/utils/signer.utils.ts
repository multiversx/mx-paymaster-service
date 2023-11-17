import { UserSigner } from "@multiversx/sdk-wallet/out/userSigner";
import { ApiConfigService } from "@mvx-monorepo/common/config/api.config.service";
import { Injectable } from "@nestjs/common";
import { readFileSync } from "fs";

@Injectable()
export class SignerUtils {
  constructor(private apiConfigService: ApiConfigService) { }

  public getAddressFromPem(): string {
    const pemFilePath = this.apiConfigService.getRelayerPEMFilePath();

    const pemFileContent = readFileSync(pemFilePath, 'utf8');
    const signer = UserSigner.fromPem(pemFileContent);

    return signer.getAddress().bech32();
  }
}
