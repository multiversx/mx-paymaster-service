import { Test } from "@nestjs/testing";
import { PaymasterService } from "../paymaster.service";
import { ApiConfigService } from "@mvx-monorepo/common";
import { TransactionDetails } from "../entities/transaction.details";
import { TokenService } from "../../tokens/token.service";
import { BadRequestException } from "@nestjs/common";
import { Address, TokenTransfer, Transaction, TransactionPayload } from "@multiversx/sdk-core/out";
import BigNumber from "bignumber.js";
import { TokenConfig } from "../../tokens/entities/token.config";
import { ApiService } from "../../../common/api/api.service";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { NetworkConfig } from "@multiversx/sdk-network-providers/out";
import { SignerUtils } from "../../../../src/utils/signer.utils";

describe('PaymasterService', () => {
  let service: PaymasterService;
  let configService: ApiConfigService;
  let apiService: ApiService;
  let tokenService: TokenService;
  let cacheService: CacheService;
  let signerUtils: SignerUtils;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymasterService,
        {
          provide: ApiConfigService,
          useValue: {
            getNumberOfShards: jest.fn(),
            getPaymasterContractAddress: jest.fn(),
            getPaymasterGasLimit: jest.fn(),
            getWrappedEGLDIdentifier: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            setRemote: jest.fn(),
          },
        },
        {
          provide: ApiService,
          useValue: {
            loadNetworkConfig: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            getEGLDPrice: jest.fn(),
            getTokenDetails: jest.fn(),
            findByIdentifier: jest.fn(),
            convertEGLDtoToken: jest.fn(),
          },
        },
        {
          provide: SignerUtils,
          useValue: {
            getAddressFromPem: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<PaymasterService>(PaymasterService);
    configService = moduleRef.get<ApiConfigService>(ApiConfigService);
    apiService = moduleRef.get<ApiService>(ApiService);
    tokenService = moduleRef.get<TokenService>(TokenService);
    cacheService = moduleRef.get<CacheService>(CacheService);
    signerUtils = moduleRef.get<SignerUtils>(SignerUtils);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRelayerPayment', () => {
    it('should throw when token is missing price or decimals', async () => {
      const token: TokenConfig = {
        identifier: 'USDC-123456',
        feeAmount: '35000',
        feePercentage: 0.5,
      };

      jest.spyOn(tokenService, 'getEGLDPrice').mockResolvedValueOnce(30);
      jest.spyOn(tokenService, 'getTokenDetails').mockResolvedValueOnce({});

      await expect(
        service.getRelayerPayment(BigNumber('650000000000000'), token)
      ).rejects.toThrowError(new BadRequestException('Missing token price or decimals'));

      jest.spyOn(tokenService, 'getTokenDetails').mockResolvedValueOnce({
        decimals: 2,
      });

      await expect(
        service.getRelayerPayment(BigNumber('650000000000000'), token)
      ).rejects.toThrowError(new BadRequestException('Missing token price or decimals'));
    });

    it('should return correct relayer payment', async () => {
      const tokenIdentifier = 'TKN-123456';
      const token: TokenConfig = {
        identifier: tokenIdentifier,
        feeAmount: '35000',
        feePercentage: 0.5,
      };

      jest.spyOn(tokenService, 'getEGLDPrice').mockResolvedValueOnce(30);
      jest.spyOn(tokenService, 'getTokenDetails').mockResolvedValueOnce({
        price: 2,
        decimals: 6,
      });
      jest.spyOn(tokenService, 'convertEGLDtoToken').mockReturnValue(BigNumber(9750));

      const tokenAmount = await service.getRelayerPayment(BigNumber('650000000000000'), token);

      expect(tokenAmount).toEqual(TokenTransfer.fungibleFromBigInteger(
        tokenIdentifier,
        BigNumber('44973'),
        6
      ));
    });

  });

  describe('generatePaymasterTx', () => {
    it('should throw error when value transfer is not 0', async () => {
      const txDetails: TransactionDetails = {
        chainID: "",
        gasLimit: 0,
        gasPrice: 0,
        nonce: 0,
        receiver: "",
        sender: "",
        value: "333",
        version: 0,
      };

      jest.spyOn(tokenService, 'findByIdentifier').mockReturnValueOnce(new TokenConfig());

      await expect(
        service.generatePaymasterTx(txDetails, 'USDC-123456')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when missing function call in data', async () => {
      const txDetails: TransactionDetails = {
        chainID: "",
        gasLimit: 0,
        gasPrice: 0,
        nonce: 0,
        receiver: "",
        sender: "",
        value: "0",
        version: 0,
      };

      jest.spyOn(tokenService, 'findByIdentifier').mockReturnValueOnce(new TokenConfig());

      await expect(
        service.generatePaymasterTx(txDetails, 'USDC-123456')
      ).rejects.toThrowError(new BadRequestException('Missing function call'));
    });

    it('should generate tx with a single payment and a function call with 1 arg', async () => {
      const tokenIdentifier = 'USDC-123456';
      const paymasterAddress = 'erd1qqqqqqqqqqqqqpgqm0lf822t2w0ly66hg27kycuk4w0guzn43hvqf28p8w';
      const relayerAddress = 'erd1vcw3y2x7fphcmddy77ef2n8nzz792d5m7xmupczc6ccaus40hytsz4fcty';
      const senderAddress = 'erd1enrnxzupjelxu6z77lw5hq8rz5nr7f9tg83zemukf2rphtgqz60sj3gxd8';

      const txDetails: TransactionDetails = {
        chainID: "D",
        gasLimit: 5000000,
        gasPrice: 1000000000,
        nonce: 0,
        receiver: "erd1qqqqqqqqqqqqqpgqvuc355rnmgljhufe34pdu2m0j0zm3xsk3hvquu2r3a",
        sender: senderAddress,
        value: "0",
        data: 'YWRkQDA4',
        version: 1,
      };

      jest.spyOn(tokenService, 'findByIdentifier').mockReturnValueOnce({
        identifier: tokenIdentifier,
        feeAmount: '35000',
        feePercentage: 0.5,
      });
      jest.spyOn(configService, 'getNumberOfShards').mockReturnValue(3);
      jest.spyOn(configService, 'getPaymasterContractAddress').mockReturnValue(paymasterAddress);
      jest.spyOn(signerUtils, 'getAddressFromPem').mockReturnValue(relayerAddress);
      jest.spyOn(configService, 'getPaymasterGasLimit').mockReturnValueOnce(7000000);
      jest.spyOn(service, 'getRelayerPayment').mockResolvedValueOnce(
        TokenTransfer.fungibleFromBigInteger(tokenIdentifier, BigNumber('40000'), 6)
      );
      jest.spyOn(configService, 'getWrappedEGLDIdentifier').mockReturnValueOnce('WEGLD-123456');
      jest.spyOn(cacheService, 'setRemote').mockResolvedValue();
      jest.spyOn(apiService, 'loadNetworkConfig').mockResolvedValue(new NetworkConfig());

      const paymasterTx = await service.generatePaymasterTx(txDetails, tokenIdentifier);

      expect(paymasterTx).toEqual(new Transaction({
        chainID: "D",
        gasLimit: 0,
        gasPrice: 1000000000,
        nonce: 0,
        receiver: new Address(senderAddress),
        sender: new Address(senderAddress),
        value: "0",
        data: new TransactionPayload('MultiESDTNFTTransfer@00000000000000000500dbfe93a94b539ff26b5742bd626396ab9e8e0a758dd8@01@555344432d313233343536@@9c40@666f7277617264457865637574696f6e@661d1228de486f8db5a4f7b2954cf310bc55369bf1b7c0e058d631de42afb917@0000000000000000050067311a5073da3f2bf1398d42de2b6f93c5b89a168dd8@616464@08'),
        version: 1,
      }));
    });
  });

});
