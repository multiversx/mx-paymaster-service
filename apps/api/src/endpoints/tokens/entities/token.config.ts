import { ApiProperty } from "@nestjs/swagger";

export class TokenConfig {
  @ApiProperty()
  identifier: string = '';

  @ApiProperty()
  feePercentage: number = 0;

  @ApiProperty()
  feeAmount: string = '';

  @ApiProperty()
  swapContract?: string;

  @ApiProperty()
  swapParameters?: string;

  @ApiProperty()
  swapMinAmount?: string;
}
