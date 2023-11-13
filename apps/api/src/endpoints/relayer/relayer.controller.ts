import { ApiConfigService } from "@mvx-monorepo/common";
import { Body, Controller, Get, NotFoundException, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RelayerDetails } from "./entities/relayer.details";
import { Transaction } from "@multiversx/sdk-core/out";
import { RelayerService } from "./relayer.service";
import { TransactionDetails } from "../paymaster/entities/transaction.details";

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
    summary: 'Generate and broadcast relayed tx',
    description: 'Generate a relayed transaction from a previously generated paymaster SC interaction',
  })
  @ApiOkResponse({ type: Transaction })
  async generateTransaction(@Body() transaction: TransactionDetails): Promise<Transaction> {
    const tx = await this.relayerService.generateRelayedTx(transaction);
    return tx;
  }
}
