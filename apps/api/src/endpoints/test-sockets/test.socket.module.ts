import { Module } from "@nestjs/common";
import { ClientOptions, ClientProxyFactory, Transport } from "@nestjs/microservices";
import { ApiConfigModule, ApiConfigService } from "@mvx-monorepo/common";
import { TestSocketService } from "./test.socket.service";
import configuration from "../../../config/configuration";

@Module({
  imports: [
    ApiConfigModule.forRoot(configuration),
  ],
  providers: [
    TestSocketService,
    {
      provide: 'PUBSUB_SERVICE',
      useFactory: (apiConfigService: ApiConfigService) => {
        const clientOptions: ClientOptions = {
          transport: Transport.REDIS,
          options: {
            host: apiConfigService.getRedisHost(),
            port: apiConfigService.getRedisPort(),
            username: apiConfigService.getRedisUsername(),
            password: apiConfigService.getRedisPassword(),
            tls: apiConfigService.getRedisTls() === true ? {} : undefined,
            retryDelay: 1000,
            retryAttempts: 10,
            retryStrategy: () => 1000,
          },
        };

        return ClientProxyFactory.create(clientOptions);
      },
      inject: [ApiConfigService],
    },
  ],
  exports: [
    TestSocketService,
  ],
})
export class TestSocketModule { }
