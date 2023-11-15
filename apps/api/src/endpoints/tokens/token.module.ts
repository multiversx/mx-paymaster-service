import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import configuration from '../../../config/configuration';
import { DynamicModuleUtils } from '@mvx-monorepo/common';

@Module({
  imports: [
    DynamicModuleUtils.getCachingModule(configuration),
  ],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule { }
