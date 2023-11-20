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
      ttl: Constants.oneMinute() * 10,
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

  static RelayedTransactions: CacheInfo = {
    key: "broadcastedRelayedTxs",
    ttl: Constants.oneMinute() * 5,
  };

  static StatusCheckTimestamp: CacheInfo = {
    key: "txStatusCheckTimestamp",
    ttl: Constants.oneMinute() * 5,
  };

  static AddressFailedTxs(address: string, hour: string) {
    return {
      key: `addressFailedTxs:${address}:${hour}`,
      ttl: Constants.oneHour(),
    };
  }

  static TotalFailedTxs(hour: string): CacheInfo {
    return {
      key: `totalFailedTxs:${hour}`,
      ttl: Constants.oneDay(),
    };
  }

  static BannedAddresses(address: string) {
    return {
      key: `bannedAddresses:${address}`,
      ttl: Constants.oneHour() * 24,
    };
  }

  static SystemPaused: CacheInfo = {
    key: "systemPaused",
    ttl: Constants.oneHour() * 8,
  };
}
