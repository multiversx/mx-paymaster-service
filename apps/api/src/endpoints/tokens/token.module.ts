import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import configuration from '../../../config/configuration';
import { DynamicModuleUtils } from '@mvx-monorepo/common';
import { ApiNetworkProvider } from '@multiversx/sdk-network-providers/out';
import { ApiService } from '../../common/api/api.service';
import { SignerUtils } from '../../utils/signer.utils';

@Module({
  imports: [
    DynamicModuleUtils.getCachingModule(configuration),
  ],
  providers: [
    TokenService,
    ApiService,
    ApiNetworkProvider,
    SignerUtils,
  ],
  exports: [TokenService],
})
export class TokenModule { }
