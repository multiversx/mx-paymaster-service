import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional } from "class-validator";
import { IsTokenIdentifier } from "../constraints/token.constraints";

export class CreateTokenDto {
  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsTokenIdentifier({
    message: 'Invalid token identifier.',
  })
  identifier?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  name?: string;
}
