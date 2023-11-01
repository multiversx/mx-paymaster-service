import { ApiProperty } from "@nestjs/swagger";
import { TransactionDetails } from "./transaction.details";
import { IsNotEmpty } from "class-validator";
import { IsTokenIdentifier } from "../../tokens/constraints/token.constraints";

export class GeneratePaymasterTxDto {
  @ApiProperty()
  transaction!: TransactionDetails;

  @ApiProperty()
  @IsNotEmpty()
  @IsTokenIdentifier({
    message: 'Invalid token identifier.',
  })
  token!: string;
}
