import { RedisCacheService } from '@multiversx/sdk-nestjs-cache';
import { Injectable } from '@nestjs/common';
import { RedlockConfiguration } from './redlock.configuration';

@Injectable()
export class RedlockService {
  constructor(private readonly redisCacheService: RedisCacheService) { }

  async release(key: string): Promise<void> {
    await this.redisCacheService.delete(key);
  }

  async tryLockResource(
    key: string,
    config: RedlockConfiguration,
  ): Promise<boolean> {
    let retryTimes = 0;
    let result = false;

    do {
      result = await this.lockOnce(key, config.keyExpiration);
      if (result) {
        return result;
      }

      retryTimes++;
      await this.sleep(config.retryInterval);
    } while (retryTimes <= config.maxRetries);

    return result;
  }

  private async lockOnce(key: string, keyExpiration: number): Promise<boolean> {
    const result = await this.redisCacheService.setnx(key, '1');
    if (result) {
      await this.redisCacheService.pexpire(key, keyExpiration);
    }
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Number(ms)));
  }
}
