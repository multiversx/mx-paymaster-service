import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ApiConfigService {
  constructor(private readonly configService: ConfigService) { }

  getApiUrl(): string {
    const apiUrl = this.configService.get<string>('urls.api');
    if (!apiUrl) {
      throw new Error('No API url present');
    }

    return apiUrl;
  }

  getSwaggerUrls(): string[] {
    const swaggerUrls = this.configService.get<string[]>('urls.swagger');
    if (!swaggerUrls) {
      throw new Error('No swagger urls present');
    }

    return swaggerUrls;
  }

  getRedisUrl(): string {
    const redisUrl = this.configService.get<string>('urls.redis');
    if (!redisUrl) {
      throw new Error('No redisUrl present');
    }

    return redisUrl;
  }

  getRedisHost(): string {
    const url = this.getRedisUrl();

    return url.split(':')[0];
  }

  getRedisPort(): number {
    const url = this.getRedisUrl();
    const components = url.split(':');

    if (components.length > 1) {
      return Number(components[1]);
    }

    return 6379;
  }

  getDatabaseHost(): string {
    const databaseHost = this.configService.get<string>('database.host');
    if (!databaseHost) {
      throw new Error('No database.host present');
    }

    return databaseHost;
  }

  getDatabasePort(): number {
    const databasePort = this.configService.get<number>('database.port');
    if (!databasePort) {
      throw new Error('No database.port present');
    }

    return databasePort;
  }


  getDatabaseUsername(): string {
    const databaseUsername = this.configService.get<string>('database.username');
    if (!databaseUsername) {
      throw new Error('No database.username present');
    }

    return databaseUsername;
  }

  getDatabasePassword(): string {
    const databasePassword = this.configService.get<string>('database.password');
    if (!databasePassword) {
      throw new Error('No database.password present');
    }

    return databasePassword;
  }

  getDatabaseName(): string {
    const databaseName = this.configService.get<string>('database.name');
    if (!databaseName) {
      throw new Error('No database.name present');
    }

    return databaseName;
  }

  getDatabaseConnection(): { host: string, port: number, username: string, password: string, database: string } {
    return {
      host: this.getDatabaseHost(),
      port: this.getDatabasePort(),
      username: this.getDatabaseUsername(),
      password: this.getDatabasePassword(),
      database: this.getDatabaseName(),
    };
  }


  getNoSQLDatabaseConnection(): string {
    return `mongodb://${this.getDatabaseHost()}:27017/${this.getDatabaseName()}`;
  }

  getIsPublicApiFeatureActive(): boolean {
    const isApiActive = this.configService.get<boolean>('features.publicApi.enabled');
    if (isApiActive === undefined) {
      throw new Error('No public api feature flag present');
    }

    return isApiActive;
  }

  getPublicApiFeaturePort(): number {
    const featurePort = this.configService.get<number>('features.publicApi.port');
    if (featurePort === undefined) {
      throw new Error('No public api port present');
    }

    return featurePort;
  }

  getIsPrivateApiFeatureActive(): boolean {
    const isApiActive = this.configService.get<boolean>('features.privateApi.enabled');
    if (isApiActive === undefined) {
      throw new Error('No private api feature flag present');
    }

    return isApiActive;
  }

  getPrivateApiFeaturePort(): number {
    const featurePort = this.configService.get<number>('features.privateApi.port');
    if (featurePort === undefined) {
      throw new Error('No private api port present');
    }

    return featurePort;
  }

  getIsCacheWarmerFeatureActive(): boolean {
    const isCacheWarmerActive = this.configService.get<boolean>('features.cacheWarmer.enabled');
    if (isCacheWarmerActive === undefined) {
      throw new Error('No cache warmer feature flag present');
    }

    return isCacheWarmerActive;
  }

  getCacheWarmerFeaturePort(): number {
    const featurePort = this.configService.get<number>('features.cacheWarmer.port');
    if (featurePort === undefined) {
      throw new Error('No cache warmer port present');
    }

    return featurePort;
  }

  getIsTransactionProcessorFeatureActive(): boolean {
    const isTransactionProcessorActive = this.configService.get<boolean>('features.transactionProcessor.enabled');
    if (isTransactionProcessorActive === undefined) {
      throw new Error('No transaction processor feature flag present');
    }

    return isTransactionProcessorActive;
  }

  getTransactionProcessorFeaturePort(): number {
    const featurePort = this.configService.get<number>('features.transactionProcessor.port');
    if (featurePort === undefined) {
      throw new Error('No transaction processor port present');
    }

    return featurePort;
  }

  getTransactionProcessorMaxLookBehind(): number {
    const maxLookBehind = this.configService.get<number>('features.transactionProcessor.maxLookBehind');
    if (maxLookBehind === undefined) {
      throw new Error('No transaction processor max look behind present');
    }

    return maxLookBehind;
  }

  getIsQueueWorkerFeatureActive(): boolean {
    const isQueueWorkerActive = this.configService.get<boolean>('features.queueWorker.enabled');
    if (isQueueWorkerActive === undefined) {
      throw new Error('No queue worker feature flag present');
    }

    return isQueueWorkerActive;
  }

  getQueueWorkerFeaturePort(): number {
    const featurePort = this.configService.get<number>('features.queueWorker.port');
    if (featurePort === undefined) {
      throw new Error('No transaction processor port present');
    }

    return featurePort;
  }

  getSecurityAdmins(): string[] {
    const admins = this.configService.get<string[]>('security.admins');
    if (admins === undefined) {
      throw new Error('No security admins value present');
    }

    return admins;
  }

  getRateLimiterSecret(): string | undefined {
    return this.configService.get<string>('rateLimiterSecret');
  }

  getAxiosTimeout(): number {
    return this.configService.get<number>('keepAliveTimeout.downstream') ?? 61000;
  }

  getIsKeepAliveAgentFeatureActive(): boolean {
    return this.configService.get<boolean>('keepAliveAgent.enabled') ?? true;
  }

  getServerTimeout(): number {
    return this.configService.get<number>('keepAliveTimeout.upstream') ?? 60000;
  }

  getHeadersTimeout(): number {
    return this.getServerTimeout() + 1000;
  }

  getUseCachingInterceptor(): boolean {
    return this.configService.get<boolean>('useCachingInterceptor') ?? false;
  }

  getElasticUrl(): string {
    const elasticUrls = this.configService.get<string[]>('urls.elastic');
    if (!elasticUrls) {
      throw new Error('No elastic urls present');
    }

    return elasticUrls[Math.floor(Math.random() * elasticUrls.length)];
  }

  getPoolLimit(): number {
    return this.configService.get<number>('caching.poolLimit') ?? 100;
  }

  getProcessTtl(): number {
    return this.configService.get<number>('caching.processTtl') ?? 60;
  }

  getUseKeepAliveAgentFlag(): boolean {
    return this.configService.get<boolean>('flags.useKeepAliveAgent') ?? true;
  }

  getIsAuthActive(): boolean {
    return this.configService.get<boolean>('api.auth') ?? false;
  }

  getNativeAuthMaxExpirySeconds(): number {
    return this.configService.get<number>('nativeAuth.maxExpirySeconds') ?? 86400;
  }

  getNativeAuthAcceptedOrigins(): string[] {
    return this.configService.get<string[]>('nativeAuth.acceptedOrigins') ?? [];
  }

  getPaymasterContractAddress(): string {
    const paymasterAddress = this.configService.get<string>('paymaster.contractAddress');
    if (paymasterAddress === undefined) {
      throw new Error('No paymaster contract address present');
    }

    return paymasterAddress;
  }

  getPaymasterGasLimit(): number {
    const gas = this.configService.get<number>('paymaster.gasLimit');
    if (gas === undefined) {
      throw new Error('No paymaster gas limit present');
    }

    return gas;
  }

  getRelayerAddress(): string {
    const relayerAddress = this.configService.get<string>('relayer.address');
    if (relayerAddress === undefined) {
      throw new Error('No relayer address present');
    }

    return relayerAddress;
  }

  getRelayerPEMFilePath(): string {
    const pemFilePath = this.configService.get<string>('relayer.pemFilePath');
    if (pemFilePath === undefined) {
      throw new Error('No relayer PEM path present');
    }

    return pemFilePath;
  }

  getRelayerEGLDFee(): string {
    const relayerFee = this.configService.get<string>('relayer.flatFeeEGLD');
    if (relayerFee === undefined) {
      throw new Error('No relayer fee present');
    }

    return relayerFee;
  }

  getAcceptedTokens(): any[] {
    const tokens = this.configService.get('tokens');
    return tokens;
  }

  getWrappedEGLDIdentifier(): string {
    const identifier = this.configService.get<string>('wrappedEGLDIdentifier');
    if (identifier === undefined) {
      throw new Error('No wrapped EGLD identifier present');
    }

    return identifier;
  }

  getIsAutoSwapFeatureActive(): boolean {
    const isAutoSwapActive = this.configService.get<boolean>('features.swap.enabled');
    if (isAutoSwapActive === undefined) {
      throw new Error('No auto swap feature flag present');
    }

    return isAutoSwapActive;
  }

  getAutoSwapCronSchedule(): string {
    const cronScheduleExpression = this.configService.get<string>('features.swap.cron');
    if (cronScheduleExpression === undefined) {
      throw new Error('No auto swap cron expression present');
    }

    return cronScheduleExpression;
  }
}
