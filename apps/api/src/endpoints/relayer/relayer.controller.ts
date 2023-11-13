import { ApiConfigService } from "@mvx-monorepo/common";
import { Body, Controller, Get, NotFoundException, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RelayerDetails } from "./entities/relayer.details";
import { GenerateRelayedTxDto } from "./entities/generate.relayed.tx.dto";
import { Transaction } from "@multiversx/sdk-core/out";
import { RelayerService } from "./relayer.service";

@ApiTags('relayer')
@Controller('relayer')
export class RelayerController {
  constructor(
    private readonly configService: ApiConfigService,
    private readonly relayerService: RelayerService
  ) { }

  @Get("/info")
  @ApiOkResponse({ type: RelayerDetails })
  @ApiNotFoundResponse({ description: 'Relayer configuration not set' })
  getInfo(): RelayerDetails {
    try {
      const result: RelayerDetails = {
        address: this.configService.getRelayerAddress(),
        name: this.configService.getRelayerName() ?? '',
      };
      return result;
    } catch (error) {
      throw new NotFoundException('Missing relayer info');
    }
  }

  @Post('/transaction')
  @UsePipes(new ValidationPipe())
  @ApiOperation({
    summary: 'Generate relayed tx',
    description: 'Generate a relayed transaction from a previously generated paymaster SC interaction',
  })
  @ApiOkResponse({ type: Transaction })
  async generateTransaction(@Body() request: GenerateRelayedTxDto): Promise<Transaction> {
    const tx = await this.relayerService.generateRelayedTx(request.transaction);
    return tx;
  }
}
