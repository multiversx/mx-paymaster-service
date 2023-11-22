import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BaseConfigService {
  constructor(protected readonly configService: ConfigService) { }

  get<T = any>(key: string): T | undefined {
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

    let keyName = match[1];
    const keySegments = keyName.split(':');

    if (keySegments.length === 0) {
      throw new Error(`Could not parse config key ${key}`);
    }

    if (keySegments.length === 1) {
      return this.configService.get(keyName);
    }

    keyName = keySegments.pop() as string;
    if (keyName === '') {
      throw new Error(`Could not parse config key ${key}`);
    }

    if (keySegments.includes('json')) {
      return this.getJson(keyName);
    }

    const envValue = this.configService.get(keyName);

    if (keySegments[0] === 'arr') {
      const expectedType = keySegments.length === 1 ? 'string' : keySegments[1];

      return this.parseValueAsArray(envValue, expectedType);
    }

    if (envValue === undefined) {
      return envValue;
    }

    return this.parseValue(envValue, keySegments[0]);
  }

  parseValue(value: string, valueType: string): any {
    switch (valueType) {
      case 'str':
        return value;
      case 'bool':
        const lowercaseValue = value?.toLowerCase();
        if (lowercaseValue === 'true' || lowercaseValue === 'false') {
          return lowercaseValue === 'true';
        }
        throw new Error(`Cannot parse config value ${value} as a boolean`);
      case 'num':
        if (value.trim() === '') {
          throw new Error(`Cannot parse config value ${value} as a number`);
        }

        if (isNaN(Number(value))) {
          throw new Error(`Cannot parse config value ${value} as a number`);
        }

        return Number(value);
      default:
        throw new Error(`Cannot parse config value ${value} as ${valueType}`);
    }
  }

  parseValueAsArray(value: string | undefined, type: string): any {
    if (value === undefined || value === '') {
      return [];
    }

    const elements = value.split(',');
    if (type === 'string') {
      return elements;
    }

    const result: any = [];
    elements.forEach(element => {
      result.push(this.parseValue(element, type));
    });

    return result;
  }

  getJson(key: string): any | undefined {
    const envValue = this.configService.get(key);

    if (envValue === undefined) return envValue;

    try {
      return JSON.parse(envValue);
    } catch (error) {
      throw new Error(`Could not parse config key ${key} as json`);
    }
  }
}
