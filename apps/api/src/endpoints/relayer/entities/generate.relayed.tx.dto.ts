import { ApiProperty } from "@nestjs/swagger";
import { TransactionDetails } from "../../paymaster/entities/transaction.details";

export class GenerateRelayedTxDto {
  @ApiProperty()
  transaction!: TransactionDetails;

  @ApiProperty()
  shouldSubmit: boolean = true;
}
