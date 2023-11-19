import { TokenService } from "../token.service";
import { ApiConfigService } from "@mvx-monorepo/common";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { ApiService } from "../../../common/api/api.service";
import { TokenConfig } from "../entities/token.config";
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import BigNumber from "bignumber.js";

describe('Token Service', () => {
  let service: TokenService;
  let configService: ApiConfigService;
  let apiService: ApiService;
  let cacheService: CacheService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: ApiConfigService,
          useValue: {
            getAcceptedTokens: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getOrSet: jest.fn(),
          },
        },
        {
          provide: ApiService,
          useValue: {
            getTokenDetailsRaw: jest.fn(),
            getEgldPriceRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<TokenService>(TokenService);
    configService = moduleRef.get<ApiConfigService>(ApiConfigService);
    apiService = moduleRef.get<ApiService>(ApiService);
    cacheService = moduleRef.get<CacheService>(CacheService);
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    const mockAcceptedTokens = [
      {
        'ASH-e3d1b7': {
          feePercentage: 5,
          feeAmount: '1000000',
          swapContract: 'erd1qqqqqqqqqqqqqpgq0e9pmlzr0nk5nkulzcmessttsjkzr4xf0n4sue4r8e',
          swapParameters: 'swapTokensFixedInput@WEGLD-a28c59@01',
          swapMinAmount: '50000000000000000',
          swapGasLimit: 12050000,
        },
      },
      {
        'ITHEUM-fce905': {
          feePercentage: 5,
          feeAmount: '1000000',
          swapContract: 'erd1qqqqqqqqqqqqqpgqus9r9gwtg24a9fvzv743hgydecpkxs8q0n4szz2az0',
          swapParameters: 'swapTokensFixedInput@WEGLD-a28c59@01',
          swapMinAmount: '1000000000000',
          swapGasLimit: 12050000,
        },
      },
    ];
    it('should return all tokens', () => {
      jest.spyOn(configService, 'getAcceptedTokens').mockReturnValue(mockAcceptedTokens);

      const results = service.findAll();

      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            identifier: 'ASH-e3d1b7',
            feePercentage: 5,
            feeAmount: '1000000',
            swapContract: 'erd1qqqqqqqqqqqqqpgq0e9pmlzr0nk5nkulzcmessttsjkzr4xf0n4sue4r8e',
            swapParameters: 'swapTokensFixedInput@WEGLD-a28c59@01',
            swapMinAmount: '50000000000000000',
            swapGasLimit: 12050000,
          }),
          expect.objectContaining({
            identifier: 'ITHEUM-fce905',
            feePercentage: 5,
            feeAmount: '1000000',
            swapContract: 'erd1qqqqqqqqqqqqqpgqus9r9gwtg24a9fvzv743hgydecpkxs8q0n4szz2az0',
            swapParameters: 'swapTokensFixedInput@WEGLD-a28c59@01',
            swapMinAmount: '1000000000000',
            swapGasLimit: 12050000,
          }),
        ]));

      expect(configService.getAcceptedTokens).toHaveBeenCalled();
    });

    it('should return an empty array if no tokens are defined in configs `tokens`', () => {
      jest.spyOn(configService, 'getAcceptedTokens').mockReturnValue([]);

      const results = service.findAll();

      expect(results).toStrictEqual([]);
    });
  });

  describe('findByIdentifier', () => {
    const mockTokens: TokenConfig[] = [
      {
        identifier: 'ASH-e3d1b7',
        feePercentage: 5,
        feeAmount: '1000000',
        swapContract: 'erd1qqqqqqqqqqqqqpgq0e9pmlzr0nk5nkulzcmessttsjkzr4xf0n4sue4r8e',
        swapParameters: 'swapTokensFixedInput@WEGLD-a28c59@01',
        swapMinAmount: '50000000000000000',
        swapGasLimit: 12050000,
      },
      {
        identifier: 'ITHEUM-fce905',
        feePercentage: 5,
        feeAmount: '1000000',
        swapContract: 'erd1qqqqqqqqqqqqqpgqus9r9gwtg24a9fvzv743hgydecpkxs8q0n4szz2az0',
        swapParameters: 'swapTokensFixedInput@WEGLD-a28c59@01',
        swapMinAmount: '1000000000000',
        swapGasLimit: 12050000,
      },
    ];
    it('should find token by identifier', () => {
      jest.spyOn(service, 'findAll').mockReturnValue(mockTokens);

      const result = service.findByIdentifier(mockTokens[0].identifier);

      expect(result).toStrictEqual(mockTokens[0]);
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should throw error if token is not found', () => {
      jest.spyOn(service, 'findAll').mockReturnValue(mockTokens);

      const invalidIdentifier = 'WEGLD-a28c59';
      const result = () => service.findByIdentifier(invalidIdentifier);

      expect(result).toThrow(NotFoundException);
      expect(result).toThrow('Token not found');
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('getEGLDPrice', () => {
    it('should get price from cache on cache hit', async () => {
      const mockPrice = 44.5;
      jest.spyOn(cacheService, 'getOrSet').mockResolvedValue(mockPrice);

      const price = await service.getEGLDPrice();

      expect(price).toBe(mockPrice);
      expect(apiService.getEgldPriceRaw).not.toHaveBeenCalled();
    });

    it('should fetch price from API on cache miss', async () => {
      const mockPrice = 100;
      jest.spyOn(cacheService, 'getOrSet').mockImplementation(async (_key, fetchFunction) => await fetchFunction());
      jest.spyOn(apiService, 'getEgldPriceRaw').mockResolvedValue(mockPrice);

      const price = await service.getEGLDPrice();

      expect(apiService.getEgldPriceRaw).toHaveBeenCalled();
      expect(price).toBe(mockPrice);
    });
  });

  //TBD
  describe.skip('convertEGLDtoToken', () => {
    it('hould correctly convert EGLD to Token', () => {
      const egldAmount = 1;
      const egldPrice = 44.6;
      const tokenPrice = 2;
      const tokenDecimals = 18;

      const result = service.convertEGLDtoToken(
        new BigNumber(egldAmount),
        new BigNumber(egldPrice),
        new BigNumber(tokenPrice),
        tokenDecimals
      );

      console.log(result);
    });
  });
});
