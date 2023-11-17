import { ApiConfigService } from "@mvx-monorepo/common/config/api.config.service";
import { SignerUtils } from "../signer.utils";
import { Test } from "@nestjs/testing";
describe('SignerUtils', () => {
  let signerUtils: SignerUtils;
  let apiConfigService: ApiConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SignerUtils,
        {
          provide: ApiConfigService, useValue: {
            getRelayerPEMFilePath: jest.fn(),
          },
        },
      ],
    }).compile();

    signerUtils = module.get<SignerUtils>(SignerUtils);
    apiConfigService = module.get<ApiConfigService>(ApiConfigService);
  });

  it('should be defined', () => {
    expect(signerUtils).toBeDefined();
  });

  it('should get address from PEM file', () => {
    jest.spyOn(apiConfigService, 'getRelayerPEMFilePath').mockReturnValue('apps/api/src/utils/specs/pemFile.pem');

    const address = signerUtils.getAddressFromPem();
    expect(address).toStrictEqual('erd142hgezlhdjhm6zvfcglfljz8fyevq4gdxyajmc23cy7xafnuw4hsxt7ahv');
    expect(apiConfigService.getRelayerPEMFilePath).toHaveBeenCalled();
  });
});
