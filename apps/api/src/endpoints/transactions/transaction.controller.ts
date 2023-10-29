import { Body, Controller, Post } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { ApiTags } from "@nestjs/swagger";
import { GeneratePaymasterTxDto } from "./entities/generate.paymaster.tx.dto";
import { Transaction } from "@multiversx/sdk-core/out";

@Controller('transactions')
@ApiTags('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) { }

  @Post('/generate-paymaster')
  async generatePaymaster(@Body() request: GeneratePaymasterTxDto): Promise<Transaction> {

    return await this.transactionService.generatePaymasterTx(request.transaction, request.token);
  }
}
