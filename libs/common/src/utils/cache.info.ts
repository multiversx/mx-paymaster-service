import { Constants } from "@multiversx/sdk-nestjs-common";

export class CacheInfo {
  key: string = "";
  ttl: number = Constants.oneSecond() * 6;

  static LastProcessedNonce(shardId: number): CacheInfo {
    return {
      key: `lastProcessedNonce:${shardId}`,
      ttl: Constants.oneMonth(),
    };
  }

  static Examples: CacheInfo = {
    key: "examples",
    ttl: Constants.oneHour(),
  };

  static PaymasterTx(sender: string, nonce: number): CacheInfo {
    return {
      key: `paymasterTx:${sender}:${nonce}`,
      ttl: Constants.oneMinute() * 2,
    };
  }
}
