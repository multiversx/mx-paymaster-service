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

  static PaymasterTx(sender: string, nonce: number): CacheInfo {
    return {
      key: `paymasterTx:${sender}:${nonce}`,
      ttl: Constants.oneMinute() * 2,
    };
  }

  static TokenDetails(identifier: string): CacheInfo {
    return {
      key: `tokenDetails:${identifier}`,
      ttl: Constants.oneSecond() * 15,
    };
  }

  static EgldPrice: CacheInfo = {
    key: "egldPrice",
    ttl: Constants.oneSecond() * 15,
  };

  static RelayerNonce(address: string): CacheInfo {
    return {
      key: `relayerNonce:${address}`,
      ttl: Constants.oneSecond() * 10,
    };
  }
}
