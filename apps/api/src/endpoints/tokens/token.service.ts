import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiConfigService, CacheInfo } from '@mvx-monorepo/common';
import BigNumber from 'bignumber.js';
import { CacheService } from '@multiversx/sdk-nestjs-cache';
import { Constants } from '@multiversx/sdk-nestjs-common';
import { TokenConfig } from './entities/token.config';
import { ApiService } from '../../common/api/api.service';
@Injectable()
export class TokenService {
  constructor(
    private readonly configService: ApiConfigService,
    private readonly cachingService: CacheService,
    private readonly apiService: ApiService,
  ) { }

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
      async () => await this.apiService.getTokenDetailsRaw(tokenIdentifier),
      CacheInfo.TokenDetails(tokenIdentifier).ttl,
      Constants.oneSecond()
    );
  }

  async getEGLDPrice(): Promise<number> {
    return await this.cachingService.getOrSet(
      CacheInfo.EgldPrice.key,
      async () => await this.apiService.getEgldPriceRaw(),
      CacheInfo.EgldPrice.ttl,
      Constants.oneSecond() * 3
    );
  }

  convertEGLDtoToken(
    egldAmount: BigNumber,
    egldPrice: BigNumber,
    tokenPrice: BigNumber,
    tokenDecimals: number
  ): BigNumber {

    const amountInUsd = egldPrice.dividedBy(`1e+18`).multipliedBy(egldAmount);
    const tokenAmount = amountInUsd.dividedBy(tokenPrice)
      .multipliedBy(`1e+${tokenDecimals}`)
      .integerValue();

    return tokenAmount;
  }
}
