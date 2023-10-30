import { Body, Controller, Post } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { ApiTags } from "@nestjs/swagger";
import { GeneratePaymasterTxDto } from "./entities/generate.paymaster.tx.dto";
import { IPlainTransactionObject } from "@multiversx/sdk-core/out";
import { GenerateRelayedTxDto } from "./entities/generate.relayed.tx.dto";

@Controller('transactions')
@ApiTags('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) { }

  @Post('/generate-paymaster')
  async generatePaymaster(@Body() request: GeneratePaymasterTxDto): Promise<IPlainTransactionObject> {

    const tx = await this.transactionService.generatePaymasterTx(request.transaction, request.token);
    return tx.toPlainObject();
  }

  @Post('/generate-relayed')
  async generateRelayed(@Body() request: GenerateRelayedTxDto): Promise<IPlainTransactionObject> {

    const tx = await this.transactionService.generateRelayedTx(request.transaction);

    if (request.shouldSubmit) {
      await this.transactionService.broadcastRelayedTx(tx);
    }

    return tx.toPlainObject();
  }
}
