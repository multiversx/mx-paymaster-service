import { Body, Controller, Delete, Get, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { Token } from './schemas/token.schema';
import { TokenService } from './token.service';
import { CreateTokenDto } from './dto/create.token.dto';
import { ParseTokenPipe } from '@multiversx/sdk-nestjs-common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('tokens')
@Controller('tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) { }

  @Post()
  @UsePipes(new ValidationPipe())
  @ApiOperation({
    summary: 'Add token',
    description: 'Insert a token accepted as relayer fee',
  })
  @ApiCreatedResponse({ type: Token })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  async create(@Body() createTokenDto: CreateTokenDto): Promise<Token> {
    return await this.tokenService.create(createTokenDto);
  }

  @ApiOperation({
    summary: 'All tokens',
    description: 'Returns all the tokens accepted as relayer fee',
  })
  @ApiOkResponse({ type: [Token] })
  @Get()
  async findAll(): Promise<Token[]> {
    return await this.tokenService.findAll();
  }

  @Get(':identifier')
  @UsePipes(new ValidationPipe())
  @ApiOperation({
    summary: 'Single token',
    description: 'Returns a single token accepted as relayer fee',
  })
  @ApiOkResponse({ type: Token })
  @ApiNotFoundResponse({ description: 'Token not found' })
  @ApiBadRequestResponse({ description: 'Invalid identifier' })
  @ApiParam({ name: 'identifier', description: 'Token identifier', required: true })
  async findOne(
    @Param('identifier', ParseTokenPipe) identifier: string
  ): Promise<Token> {
    return await this.tokenService.findByIdentifier(identifier);
  }

  @Delete(':identifier')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Delete token' })
  @ApiNotFoundResponse({ description: 'Token not found.' })
  @ApiBadRequestResponse({ description: 'Invalid identifier' })
  @ApiOkResponse({
    status: 200,
    description: 'Token has been deleted',
  })
  async delete(
    @Param('identifier', ParseTokenPipe) identifier: string
  ) {
    await this.tokenService.delete(identifier);
    return { code: 200, message: 'Token deleted' };
  }
}
