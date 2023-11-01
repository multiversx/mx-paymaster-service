import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Token, TokenDocument } from './entities/schemas/token.schema';
import { CreateTokenDto } from './entities/create.token.dto';
import { ApiNetworkProvider } from '@multiversx/sdk-network-providers/out';
import { ApiConfigService, CacheInfo } from '@mvx-monorepo/common';
import BigNumber from 'bignumber.js';
import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { Constants } from '@multiversx/sdk-nestjs-common';

@Injectable()
export class TokenService {
  private readonly networkProvider: ApiNetworkProvider;

  constructor(
    @InjectModel(Token.name) private readonly tokenModel: Model<TokenDocument>,
    private readonly configService: ApiConfigService,
    private readonly cachingService: CacheService
  ) {
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
  }

  async create(createTokenDto: CreateTokenDto): Promise<Token> {
    const token = new this.tokenModel(createTokenDto);

    try {
      await this.getTokenDetails(token.identifier);

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
      throw new NotFoundException(`Token not found`);
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

  async getTokenDetails(tokenIdentifier: string): Promise<any> {
    return await this.cachingService.getOrSet(
      CacheInfo.TokenDetails(tokenIdentifier).key,
      async () => await this.getTokenDetailsRaw(tokenIdentifier),
      CacheInfo.TokenDetails(tokenIdentifier).ttl,
      Constants.oneSecond()
    );
  }

  async getTokenDetailsRaw(tokenIdentifier: string): Promise<any> {
    const url = `tokens/${tokenIdentifier}`;

    try {
      return await this.networkProvider.doGetGeneric(url);
    } catch (error) {
      throw new BadRequestException('Invalid token identifier');
    }
  }

  async getEGLDPrice(): Promise<number> {
    return await this.cachingService.getOrSet(
      CacheInfo.EgldPrice.key,
      async () => await this.getEGLDPriceRaw(),
      CacheInfo.EgldPrice.ttl,
      Constants.oneSecond() * 3
    );
  }

  async getEGLDPriceRaw(): Promise<number> {
    const url = `economics?extract=price`;

    try {
      return await this.networkProvider.doGetGeneric(url);
    } catch (error) {
      throw new BadRequestException('Invalid token identifier');
    }
  }

  convertEGLDtoToken(
    egldAmount: BigNumber,
    egldPrice: number,
    tokenPrice: number,
    tokenDecimals: number
  ): BigNumber {

    const amountInUsd = BigNumber(egldPrice).dividedBy(`1e+18`).multipliedBy(egldAmount);
    const tokenAmount = amountInUsd.dividedBy(BigNumber(tokenPrice))
      .multipliedBy(`1e+${tokenDecimals}`)
      .integerValue();

    return tokenAmount;
  }
}
