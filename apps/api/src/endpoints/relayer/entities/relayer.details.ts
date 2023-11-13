import { ApiResponseProperty } from "@nestjs/swagger";

export class RelayerDetails {
  @ApiResponseProperty()
  address: string = '';

  @ApiResponseProperty()
  name: string = '';
}
