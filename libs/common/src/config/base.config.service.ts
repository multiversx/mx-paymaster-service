import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BaseConfigService {
  constructor(protected readonly configService: ConfigService) { }

  get<T = any>(key: string, defaultValue?: T): T | undefined {
    const configValue = this.configService.get<T>(key);
    if (key === 'globalPrefix') {
      console.log('config', configValue);
    }
    if (configValue === undefined && !defaultValue) {
      return;
    }

    if (configValue === undefined) {
      return defaultValue;
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
    return this.configService.get(keyName);
  }
}
