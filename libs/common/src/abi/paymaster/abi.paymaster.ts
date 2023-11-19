import { Address, AddressValue, BytesType, BytesValue, TokenTransfer, Transaction, TypedValue, VariadicType, VariadicValue } from "@multiversx/sdk-core/out";
import { ContractLoader } from "../interactions";
import { TransactionMetadata } from "@multiversx/sdk-transaction-decoder/lib/src/transaction.decoder";

const ABI_PATH: string = 'libs/common/src/abi/paymaster/abi.json';

export class AbiPaymaster {
  private readonly contractLoader: ContractLoader = new ContractLoader(ABI_PATH);

  async forwardExecution(senderAddress: string, contractAddress: string, scArguments: TypedValue[],
    multiTransfer: TokenTransfer[], gasLimit: number, gasPrice: number, nonce: number, chainID: string): Promise<Transaction> {
    const contract = await this.contractLoader.getContract(contractAddress);
    const signerAddress = new Address(senderAddress);

    const transaction = contract.methodsExplicit
      .forwardExecution(
        scArguments
      ).withSender(
        signerAddress
      ).withGasLimit(
        gasLimit
      ).withGasPrice(
        gasPrice
      ).withMultiESDTNFTTransfer(
        multiTransfer
      ).withNonce(
        nonce
      ).withChainID(
        chainID
      ).buildTransaction();
    return transaction;
  }

  getTypedSCArguments(relayerAddress: string, innerTxMetadata: TransactionMetadata): TypedValue[] {
    let endpointParams: TypedValue[] = [];
    if (innerTxMetadata.functionArgs) {
      endpointParams = innerTxMetadata.functionArgs.map((element) =>
        BytesValue.fromHex(element)
      );
    }

    return [
      new AddressValue(new Address(relayerAddress)),
      new AddressValue(new Address(innerTxMetadata.receiver)),
      BytesValue.fromUTF8(innerTxMetadata.functionName ?? ''),
      new VariadicValue(new VariadicType(new BytesType()), endpointParams),
    ];
  }
}
