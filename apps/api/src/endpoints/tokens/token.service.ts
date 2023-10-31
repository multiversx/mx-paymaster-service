import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Token, TokenDocument } from './schemas/token.schema';
import { CreateTokenDto } from './dto/create.token.dto';
import { ApiNetworkProvider } from '@multiversx/sdk-network-providers/out';
import { ApiConfigService } from '@mvx-monorepo/common';

@Injectable()
export class TokenService {
  private readonly networkProvider: ApiNetworkProvider;

  constructor(
    @InjectModel(Token.name) private readonly tokenModel: Model<TokenDocument>,
    private readonly configService: ApiConfigService,
  ) {
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
  }

  async create(createTokenDto: CreateTokenDto): Promise<Token> {
    const token = new this.tokenModel(createTokenDto);

    try {
      await this.getTokenFromAPI(token.identifier);

      return await token.save();
    } catch (error: any) {
      if (error.code && error.code === 11000) {
        throw new BadRequestException(`Duplicate data`);
      }
      throw new BadRequestException(`Invalid data`);
    }
  }

  async findAll(): Promise<Token[]> {
    return await this.tokenModel.find().exec();
  }

  async findByIdentifier(identifier: string): Promise<Token> {
    const token = await this.tokenModel.findOne({ identifier: identifier }).exec();
    if (!token) {
      throw new NotFoundException();
    }

    return token;
  }

  async delete(identifier: string): Promise<void> {
    const token = await this.tokenModel.findOneAndRemove({
      identifier: identifier,
    });

    if (!token) {
      throw new NotFoundException(`Token not found`);
    }
  }

  async getTokenFromAPI(tokenIdentifier: string) {
    const token = await this.networkProvider.getDefinitionOfFungibleToken(tokenIdentifier);
    return token;
  }
}
