import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional } from "class-validator";

export class TransactionDetails {
  @ApiProperty()
  @IsNotEmpty()
  chainID: string = '';

  @ApiProperty({ default: undefined, required: false })
  @IsOptional()
  data?: string;

  @ApiProperty()
  @IsInt()
  gasLimit: number = 0;

  @ApiProperty()
  @IsInt()
  gasPrice: number = 0;

  @ApiProperty()
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
  value: string = '';

  @ApiProperty()
  version: number = 0;

  @ApiProperty()
  options?: number;

  @ApiProperty()
  guardian?: string;

  @ApiProperty()
  guardianSignature?: string;
}
