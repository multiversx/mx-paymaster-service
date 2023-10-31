import { Body, Controller, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { GeneratePaymasterTxDto } from "./entities/generate.paymaster.tx.dto";
import { Transaction } from "@multiversx/sdk-core/out";
import { GenerateRelayedTxDto } from "./entities/generate.relayed.tx.dto";

@Controller('transactions')
@ApiTags('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) { }

  @Post('/generate-paymaster')
  @UsePipes(new ValidationPipe())
  @ApiOperation({
    summary: 'Paymaster tx',
    description: 'Generate a Paymaster SC transaction from a regular transaction',
  })
  @ApiOkResponse({ type: Transaction })
  async generatePaymaster(@Body() request: GeneratePaymasterTxDto): Promise<Transaction> {
    const tx = await this.transactionService.generatePaymasterTx(request.transaction, request.token);
    // console.log(tx.toPlainObject());
    return tx;
  }

  @Post('/generate-relayed')
  @UsePipes(new ValidationPipe())
  async generateRelayed(@Body() request: GenerateRelayedTxDto): Promise<Transaction> {

    const tx = await this.transactionService.generateRelayedTx(request.transaction);

    if (request.shouldSubmit) {
      await this.transactionService.broadcastRelayedTx(tx);
    }

    return tx;
  }
}
