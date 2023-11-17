import { OriginLogger } from "@multiversx/sdk-nestjs-common";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers/out";
import { ApiConfigService } from "@mvx-monorepo/common";
import { BadRequestException, Injectable } from "@nestjs/common";
import { SignerUtils } from "../../utils/signer.utils";

@Injectable()
export class ApiService {
  private readonly logger = new OriginLogger(ApiService.name);
  private readonly networkProvider: ApiNetworkProvider;
  private readonly relayerAddress: string;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly signerUtils: SignerUtils,
  ) {
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
    this.relayerAddress = this.signerUtils.getAddressFromPem();
  }

  async getEgldPriceRaw(): Promise<any> {
    try {
      const url = `economics?extract=price`;
      const response = await this.networkProvider.doGetGeneric(url);
      return response;
    } catch (error) {
      this.logger.error(error);
      this.logger.error(`Error getting EGLD price`);
      throw new BadRequestException(`Error getting EGLD price`);
    }
  }

  async getTokenDetailsRaw(identifier: string): Promise<any> {
    try {
      const url = `tokens/${identifier}`;
      const response = await this.networkProvider.doGetGeneric(url);
      return response;
    } catch (error) {
      this.logger.error(error);
      this.logger.error(`Error whe getting details for ${identifier}`);
      throw new BadRequestException(`Error whe getting details for ${identifier}`);
    }
  }

  async getAccountTokenByIdentifiers(identifier: string): Promise<any> {
    try {
      const url = `accounts/${this.relayerAddress}/tokens?identifiers=${identifier}`;
      const response = await this.networkProvider.doGetGeneric(url);
      return response;
    } catch (error) {
      this.logger.error(`Get relayer token balance request failed with error: ${error}`);
      throw new Error('Fetch relayer token balance request failed.');
    }
  }

  async getAccountToken(wrappedEgldIdentifier: string): Promise<any> {
    try {
      const url = `accounts/${this.relayerAddress}/tokens/${wrappedEgldIdentifier}`;
      const response = await this.networkProvider.doGetGeneric(url);
      return response;
    } catch (error) {
      this.logger.error(`Get relayer token request failed with error: ${error}`);
      return undefined;
    }
  }
}
