import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApiNetworkProvider } from '@multiversx/sdk-network-providers/out';
import { ApiConfigService, CacheInfo } from '@mvx-monorepo/common';
import BigNumber from 'bignumber.js';
import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { Constants } from '@multiversx/sdk-nestjs-common';
import { TokenConfig } from './entities/token.config';

@Injectable()
export class TokenService {
  private readonly networkProvider: ApiNetworkProvider;

  constructor(
    private readonly configService: ApiConfigService,
    private readonly cachingService: CacheService
  ) {
    this.networkProvider = new ApiNetworkProvider(this.configService.getApiUrl());
  }

  findAll(): TokenConfig[] {
    const tokens = this.configService.getAcceptedTokens();
    return tokens.map((elem) => {
      const identifier = Object.keys(elem)[0];
      return {
        identifier: identifier,
        ...elem[identifier],
      };
    });
  }

  findByIdentifier(identifier: string): TokenConfig {
    const allTokens = this.findAll();
    const token = allTokens.find(elem => elem.identifier === identifier);

    if (!token) {
      throw new NotFoundException('Token not found');
    }
    return token;
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
