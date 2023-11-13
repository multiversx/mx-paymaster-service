import { ApiProperty } from "@nestjs/swagger";
import { TransactionDetails } from "./transaction.details";
import { IsNotEmpty, IsNotEmptyObject, ValidateNested } from "class-validator";
import { IsTokenIdentifier } from "../../tokens/constraints/token.constraints";
import { Type } from 'class-transformer';

export class GeneratePaymasterTxDto {
  @ApiProperty({ type: TransactionDetails })
  @ValidateNested()
  @IsNotEmptyObject()
  @Type(() => TransactionDetails)
  transaction!: TransactionDetails;

  @ApiProperty()
  @IsNotEmpty()
  @IsTokenIdentifier({
    message: 'Invalid token identifier.',
  })
  token!: string;
}
