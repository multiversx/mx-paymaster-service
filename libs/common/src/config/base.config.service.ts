import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BaseConfigService {
  constructor(protected readonly configService: ConfigService) { }

  get<T = any>(key: string, isIterableValue: boolean = false): T | undefined {
    const configValue = this.configService.get<T>(key);

    if (configValue === undefined) {
      return;
    }

    if (typeof configValue !== 'string') {
      return configValue;
    }

    const regex = /\$\{([^}]+)\}/;
    const match = configValue.match(regex);

    if (!match) {
      return configValue;
    }

    const keyName = match[1];
    const envValue = this.configService.get(keyName);

    if (!isIterableValue || envValue === undefined) return envValue;

    const result: any = envValue === '' ? [] : [...envValue.split(',')];
    return result;
  }
}
