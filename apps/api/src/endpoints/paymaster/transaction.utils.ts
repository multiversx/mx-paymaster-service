import { TransactionDecoder, TransactionMetadata } from "@multiversx/sdk-transaction-decoder/lib/src/transaction.decoder";
import { TransactionDetails } from "./entities/transaction.details";
import { TokenTransfer, Transaction } from "@multiversx/sdk-core/out";
import BigNumber from "bignumber.js";

export class TransactionUtils {
  static extractMetadata(txDetails: TransactionDetails): TransactionMetadata {
    const decoder = new TransactionDecoder();
    const metadata = decoder.getTransactionMetadata({
      sender: txDetails.sender,
      receiver: txDetails.receiver,
      data: txDetails.data ?? '',
      value: txDetails.value,
    });

    return metadata;
  }

  static extractTransfersFromMetadata(metadata: TransactionMetadata): TokenTransfer[] {
    if (!metadata.transfers) {
      return [];
    }

    return metadata.transfers.map((element) => {
      if (element.properties?.token) {
        return TokenTransfer.fungibleFromBigInteger(
          element.properties.token,
          new BigNumber(element.value.toString())
        );
      }

      if (element.properties?.collection && element.properties.identifier) {
        const nonce = element.properties.identifier?.split('-')[2];
        return TokenTransfer.nonFungible(
          element.properties.collection,
          parseInt(nonce, 16)
        );
      }

      if (!element.properties?.identifier) {
        throw new Error('Invalid token transfer in data');
      }

      const tokenInfo = element.properties?.identifier?.split('-');
      const nonce = tokenInfo?.length === 3 ? tokenInfo[2] : '0';
      const identifier = tokenInfo[0] + '-' + tokenInfo[1];
      return TokenTransfer.metaEsdtFromBigInteger(
        identifier,
        parseInt(nonce, 16),
        new BigNumber(element.value.toString())
      );
    });
  }

  static convertObjectToTransaction(plainTx: TransactionDetails): Transaction {
    const transaction = Transaction.fromPlainObject({
      nonce: plainTx.nonce,
      sender: plainTx.sender,
      receiver: plainTx.receiver,
      value: '0',
      gasLimit: plainTx.gasLimit,
      gasPrice: plainTx.gasPrice,
      chainID: plainTx.chainID,
      data: plainTx.data,
      signature: plainTx.signature,
      version: plainTx.version ?? 1,
    });
    return transaction;
  }
}
