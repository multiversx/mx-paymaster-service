import { Module } from '@nestjs/common';
import { RedlockService } from './redlock.service';
import { DynamicModuleUtils } from '../utils';

@Module({})
export class RedlockModule {
  static register(configuration: () => Record<string, any>) {
    return {
      module: RedlockModule,
      imports: [
        DynamicModuleUtils.getRedisModule(configuration),
      ],
      providers: [RedlockService],
      exports: [RedlockService],
    };
  }
}
