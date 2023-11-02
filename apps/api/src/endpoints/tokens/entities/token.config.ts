import { ApiProperty } from "@nestjs/swagger";

export class TokenConfig {
  @ApiProperty()
  identifier: string = '';

  @ApiProperty()
  feePercentage: number = 0;

  @ApiProperty()
  feeAmount: string = '';
}
