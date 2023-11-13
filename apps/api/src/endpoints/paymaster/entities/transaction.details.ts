import { IPlainTransactionObject } from "@multiversx/sdk-core/out";
import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional } from "class-validator";

export class TransactionDetails implements IPlainTransactionObject {
  @ApiProperty()
  @IsNotEmpty()
  chainID: string = '';

  @ApiProperty()
  @IsNotEmpty()
  data?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  gasLimit: number = 0;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  gasPrice: number = 0;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  nonce: number = 0;

  @ApiProperty()
  @IsNotEmpty()
  receiver: string = '';

  @ApiProperty()
  @IsNotEmpty()
  sender: string = '';

  @ApiProperty()
  @IsOptional()
  signature?: string = '';

  @ApiProperty()
  @IsNotEmpty()
  value: string = '';

  @ApiProperty()
  @IsOptional()
  version: number = 1;

  @ApiProperty()
  @IsOptional()
  options?: number = 0;
}
