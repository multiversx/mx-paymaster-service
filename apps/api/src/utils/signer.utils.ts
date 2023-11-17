import { UserSigner } from "@multiversx/sdk-wallet/out/userSigner";
import { ApiConfigService } from "@mvx-monorepo/common/config/api.config.service";
import { Injectable } from "@nestjs/common";
import { readFileSync } from "fs";

@Injectable()
export class SignerUtils {
  private signer: UserSigner | null = null;
  constructor(private apiConfigService: ApiConfigService) { }

  public getAddressFromPem(): string {
    return this.getSigner().getAddress().bech32();
  }

  public getSigner(): UserSigner {
    if (!this.signer) {
      this.initializeSigner();
    }
    return this.signer as UserSigner;
  }

  private initializeSigner(): void {
    const pemFilePath = this.apiConfigService.getRelayerPEMFilePath();
    const pemFileContent = readFileSync(pemFilePath, 'utf8');
    this.signer = UserSigner.fromPem(pemFileContent);
  }
}
