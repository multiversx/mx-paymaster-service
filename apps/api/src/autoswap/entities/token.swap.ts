import { ApiProperty } from "@nestjs/swagger";

export class TokenSwap {
  @ApiProperty()
  identifier: string = '';

  @ApiProperty()
  swapContract!: string;

  @ApiProperty()
  swapParameters!: string;

  @ApiProperty()
  swapGasLimit: number = 0;

  @ApiProperty()
  amount!: string;
}
