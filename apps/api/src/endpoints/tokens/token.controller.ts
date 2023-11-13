import { Controller, Get, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { TokenService } from './token.service';
import { ParseTokenPipe } from '@multiversx/sdk-nestjs-common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { TokenConfig } from './entities/token.config';

@ApiTags('tokens')
@Controller('tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) { }

  @ApiOperation({
    summary: 'All tokens',
    description: 'Returns all the tokens accepted as relayer fee',
  })
  @ApiOkResponse({ type: [TokenConfig] })
  @Get()
  findAll(): TokenConfig[] {
    return this.tokenService.findAll();
  }

  @Get(':identifier')
  @UsePipes(new ValidationPipe())
  @ApiOperation({
    summary: 'Single token',
    description: 'Returns a single token accepted as relayer fee',
  })
  @ApiOkResponse({ type: TokenConfig })
  @ApiNotFoundResponse({ description: 'Token not found' })
  @ApiBadRequestResponse({ description: 'Invalid identifier' })
  @ApiParam({ name: 'identifier', description: 'Token identifier', required: true })
  findOne(
    @Param('identifier', ParseTokenPipe) identifier: string
  ): TokenConfig {
    return this.tokenService.findByIdentifier(identifier);
  }
}
