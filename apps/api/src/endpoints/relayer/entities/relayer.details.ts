import { ApiResponseProperty } from "@nestjs/swagger";

export class RelayerDetails {
  @ApiResponseProperty()
  feeInEGLD: string = '';

  @ApiResponseProperty()
  address: string = '';
}
