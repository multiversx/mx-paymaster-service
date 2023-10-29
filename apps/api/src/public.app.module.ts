import { Module } from '@nestjs/common';
import { EndpointsServicesModule } from './endpoints/endpoints.services.module';
import { EndpointsControllersModule } from './endpoints/endpoints.controllers.module';
import { ApiConfigModule, DynamicModuleUtils } from '@mvx-monorepo/common';
import { LoggingModule } from '@multiversx/sdk-nestjs-common';
import configuration from '../config/configuration';

@Module({
  imports: [
    LoggingModule,
    EndpointsServicesModule,
    EndpointsControllersModule,
    ApiConfigModule.forRoot(configuration),
  ],
  providers: [
    DynamicModuleUtils.getNestJsApiConfigService(),
  ],
  exports: [
    EndpointsServicesModule,
  ],
})
export class PublicAppModule { }
