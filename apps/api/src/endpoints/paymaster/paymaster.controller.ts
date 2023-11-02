import { Body, Controller, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { PaymasterService } from "./paymaster.service";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { GeneratePaymasterTxDto } from "./entities/generate.paymaster.tx.dto";
import { Transaction } from "@multiversx/sdk-core/out";

@Controller('paymaster')
@ApiTags('paymaster')
export class PaymasterController {
  constructor(private readonly transactionService: PaymasterService) { }

  @Post('/transaction')
  @UsePipes(new ValidationPipe())
  @ApiOperation({
    summary: 'Generate SC interaction tx',
    description: 'Generate a Paymaster SC transaction from a regular transaction',
  })
  @ApiOkResponse({ type: Transaction })
  async generateTransaction(@Body() request: GeneratePaymasterTxDto): Promise<Transaction> {
    const tx = await this.transactionService.generatePaymasterTx(request.transaction, request.token);

    return tx;
  }
}
