import 'module-alias/register';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { join } from 'path';
import { ApiConfigService, SdkNestjsConfigServiceImpl } from '@mvx-monorepo/common';
import { PrivateAppModule } from './private.app.module';
import { PublicAppModule } from './public.app.module';
import * as bodyParser from 'body-parser';
import { Logger, NestInterceptor } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SocketAdapter } from './websockets/socket.adapter';
import cookieParser from 'cookie-parser';
import { PubSubListenerModule } from '@mvx-monorepo/common';
import { LoggingInterceptor, MetricsService } from '@multiversx/sdk-nestjs-monitoring';
import { NativeAuthGuard } from '@multiversx/sdk-nestjs-auth';
import { LoggerInitializer } from '@multiversx/sdk-nestjs-common';
import { CacheService, CachingInterceptor } from '@multiversx/sdk-nestjs-cache';

import '@multiversx/sdk-nestjs-common/lib/utils/extensions/array.extensions';
import '@multiversx/sdk-nestjs-common/lib/utils/extensions/date.extensions';
import '@multiversx/sdk-nestjs-common/lib/utils/extensions/number.extensions';
import '@multiversx/sdk-nestjs-common/lib/utils/extensions/string.extensions';
import configuration from '../config/configuration';
import { SwapModule } from './autoswap/swap.module';
import { DrainProtectionModule } from './drain-protection/drain.protection.module';

async function bootstrap() {
  const publicApp = await NestFactory.create(PublicAppModule);
  publicApp.use(bodyParser.json({ limit: '1mb' }));
  publicApp.enableCors();
  publicApp.useLogger(publicApp.get(WINSTON_MODULE_NEST_PROVIDER));
  publicApp.use(cookieParser());

  const apiConfigService = publicApp.get<ApiConfigService>(ApiConfigService);
  const cachingService = publicApp.get<CacheService>(CacheService);
  const metricsService = publicApp.get<MetricsService>(MetricsService);
  const httpAdapterHostService = publicApp.get<HttpAdapterHost>(HttpAdapterHost);
  const globalPrefix = apiConfigService.getGlobalPrefix();

  if (apiConfigService.getIsAuthActive()) {
    publicApp.useGlobalGuards(new NativeAuthGuard(new SdkNestjsConfigServiceImpl(apiConfigService), cachingService));
  }

  const httpServer = httpAdapterHostService.httpAdapter.getHttpServer();
  httpServer.keepAliveTimeout = apiConfigService.getServerTimeout();
  httpServer.headersTimeout = apiConfigService.getHeadersTimeout(); //`keepAliveTimeout + server's expected response time`

  const globalInterceptors: NestInterceptor[] = [];
  globalInterceptors.push(new LoggingInterceptor(metricsService));

  if (apiConfigService.getUseCachingInterceptor()) {
    const cachingInterceptor = new CachingInterceptor(
      cachingService,
      httpAdapterHostService,
      metricsService,
    );

    globalInterceptors.push(cachingInterceptor);
  }

  publicApp.useGlobalInterceptors(...globalInterceptors);
  publicApp.setGlobalPrefix(globalPrefix);

  const description = readFileSync(join(__dirname, '..', 'docs', 'swagger.md'), 'utf8');

  let documentBuilder = new DocumentBuilder()
    .setTitle('MultiversX Paymaster Service API')
    .setDescription(description)
    .setVersion('1.0.0')
    .setExternalDoc('MultiversX Docs', 'https://docs.multiversx.com');

  const apiUrls = apiConfigService.getSwaggerUrls();
  for (const apiUrl of apiUrls) {
    documentBuilder = documentBuilder.addServer(apiUrl);
  }

  const config = documentBuilder.build();

  const options = {
    customSiteTitle: 'Multiversx Paymaster Service API',
    customCss: `.swagger-ui .topbar { display:none }
          .swagger-ui .scheme-container {background-color: #FAFAFA;}`,
  };

  const document = SwaggerModule.createDocument(publicApp, config);
  SwaggerModule.setup(globalPrefix, publicApp, document, options);
  SwaggerModule.setup(`${globalPrefix}/docs`, publicApp, document, options);

  if (apiConfigService.getIsPublicApiFeatureActive()) {
    await publicApp.listen(apiConfigService.getPublicApiFeaturePort());
  }

  if (apiConfigService.getIsPrivateApiFeatureActive()) {
    const privateApp = await NestFactory.create(PrivateAppModule);
    privateApp.setGlobalPrefix(globalPrefix);
    await privateApp.listen(apiConfigService.getPrivateApiFeaturePort());
  }

  if (apiConfigService.getIsAutoSwapFeatureActive()) {
    const autoSwapApp = await NestFactory.create(SwapModule);
    autoSwapApp.setGlobalPrefix(globalPrefix);
    await autoSwapApp.listen(7777);
  }

  if (apiConfigService.getIsDrainProtectionFeatureActive()) {
    const drainProtectionApp = await NestFactory.create(DrainProtectionModule);
    drainProtectionApp.setGlobalPrefix(globalPrefix);
    await drainProtectionApp.listen(7778);
  }

  const logger = new Logger('Bootstrapper');

  LoggerInitializer.initialize(logger);

  const pubSubApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    PubSubListenerModule.forRoot(configuration),
    {
      transport: Transport.REDIS,
      options: {
        host: apiConfigService.getRedisHost(),
        port: apiConfigService.getRedisPort(),
        username: apiConfigService.getRedisUsername(),
        password: apiConfigService.getRedisPassword(),
        tls: apiConfigService.getRedisTls() === true ? {} : undefined,
        retryAttempts: 100,
        retryDelay: 1000,
        retryStrategy: () => 1000,
      },
    },
  );
  pubSubApp.useLogger(pubSubApp.get(WINSTON_MODULE_NEST_PROVIDER));
  pubSubApp.useWebSocketAdapter(new SocketAdapter(pubSubApp));
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  pubSubApp.listen();

  logger.log(`Public API active: ${apiConfigService.getIsPublicApiFeatureActive()}`);
  logger.log(`Private API active: ${apiConfigService.getIsPrivateApiFeatureActive()}`);
  logger.log(`AutoSwap active: ${apiConfigService.getIsAutoSwapFeatureActive()}`);
  logger.log(`Drain Protection active: ${apiConfigService.getIsDrainProtectionFeatureActive()}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
