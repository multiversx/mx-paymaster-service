import { ApiConfigService } from "@mvx-monorepo/common";
import { Controller, Get, NotFoundException } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RelayerDetails } from "./entities/relayer.details";

@ApiTags('relayer')
@Controller()
export class RelayerController {
  constructor(
    private readonly configService: ApiConfigService
  ) { }

  @Get("/relayer-info")
  @ApiOkResponse({ type: RelayerDetails })
  @ApiNotFoundResponse({ description: 'Relayer configuration not set' })
  getFee(): RelayerDetails {
    try {
      const result: RelayerDetails = {
        feeInEGLD: this.configService.getRelayerEGLDFee(),
        address: this.configService.getRelayerAddress(),
      };
      return result;
    } catch (error) {
      throw new NotFoundException('Missing relayer info');
    }
  }
}
