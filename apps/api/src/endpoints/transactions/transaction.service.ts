import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionDetails } from "./entities/transaction.details";
import { Address, AddressValue, BytesType, BytesValue, TokenTransfer, Transaction, TypedValue, VariadicType, VariadicValue } from "@multiversx/sdk-core/out";
import { ApiService } from "@multiversx/sdk-nestjs-http";
import { ApiConfigService, ContractLoader, ContractTransactionGenerator } from "@mvx-monorepo/common";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers/out";
import { TransactionDecoder, TransactionMetadata } from "@multiversx/sdk-transaction-decoder/lib/src/transaction.decoder";
import BigNumber from "bignumber.js";

@Injectable()
export class TransactionService {
  private readonly contractLoader: ContractLoader;
  private readonly txGenerator: ContractTransactionGenerator;

  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ApiConfigService
  ) {
    this.contractLoader = new ContractLoader(`apps/api/src/abis/paymaster.abi.json`);
    this.txGenerator = new ContractTransactionGenerator(
      new ApiNetworkProvider(this.configService.getApiUrl())
    );
  }

  async convertEGLDtoToken(egldAmount: BigNumber, tokenIdentifier: string): Promise<{
    tokenAmount: BigNumber,
    decimals: number
  }> {
    const { egldPrice, tokenPrice, tokenDecimals } = await this.getPricesInUsd(tokenIdentifier);

    const amountInUsd = BigNumber(egldPrice).dividedBy(`1e+18`).multipliedBy(egldAmount);
    const tokenAmount = amountInUsd.dividedBy(BigNumber(tokenPrice))
      .multipliedBy(`1e+${tokenDecimals}`)
      .integerValue();

    return {
      tokenAmount: tokenAmount,
      decimals: tokenDecimals,
    };
  }

  async calculateRelayerPayment(gasLimit: number, tokenIdentifier: string): Promise<TokenTransfer> {
    const flatFee = BigNumber(this.configService.getRelayerEGLDFee());
    const egldAmount = BigNumber(gasLimit).plus(flatFee);

    const { tokenAmount, decimals } = await this.convertEGLDtoToken(egldAmount, tokenIdentifier);
    const relayerPayment = TokenTransfer.fungibleFromBigInteger(
      tokenIdentifier,
      tokenAmount,
      decimals
    );

    return relayerPayment;
  }

  async generatePaymasterTx(txDetails: TransactionDetails, tokenIdentifier: string):
    Promise<Transaction> {
    const metadata = this.extractMetadata(txDetails);

    if (metadata.value.toString() !== '0') {
      throw new BadRequestException('Value transfer is not allowed');
    }

    if (!metadata.functionName) {
      throw new BadRequestException('Missing function call');
    }

    const paymasterAddress = this.configService.getPaymasterContractAddress();
    const relayerAddress = this.configService.getRelayerAddress();
    const signerAddress = new Address(txDetails.sender);

    const contract = await this.contractLoader.getContract(paymasterAddress);
    const gasLimit = this.configService.getPaymasterGasLimit() + txDetails.gasLimit;

    let endpointParams: TypedValue[] = [];
    if (metadata.functionArgs) {
      endpointParams = metadata.functionArgs.map((element) =>
        BytesValue.fromHex(element)
      );
    }

    const multiTransfer = [
      await this.calculateRelayerPayment(gasLimit, tokenIdentifier),
      ...this.extractTransfersFromMetadata(metadata),
    ];

    const interaction = contract.methodsExplicit
      .forwardExecution([
        new AddressValue(new Address(relayerAddress)),
        new AddressValue(new Address(metadata.receiver)),
        BytesValue.fromUTF8(metadata.functionName),
        new VariadicValue(new VariadicType(new BytesType()), endpointParams),
      ]).withSender(
        signerAddress
      ).withGasLimit(
        gasLimit
      ).withMultiESDTNFTTransfer(multiTransfer);

    const transaction = await this.txGenerator.createTransaction(interaction, signerAddress);
    console.log(transaction.toPlainObject());

    return transaction;
  }

  extractMetadata(txDetails: TransactionDetails): TransactionMetadata {
    const decoder = new TransactionDecoder();
    const metadata = decoder.getTransactionMetadata({
      sender: txDetails.sender,
      receiver: txDetails.receiver,
      data: txDetails.data ?? '',
      value: '0',
    });

    return metadata;
  }

  extractTransfersFromMetadata(metadata: TransactionMetadata): TokenTransfer[] {
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
        throw new BadRequestException('Invalid token transfer in data');
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

  private async getPricesInUsd(tokenIdentifier: string): Promise<{
    egldPrice: number,
    tokenPrice: number,
    tokenDecimals: number
  }> {
    const egldTicker = 'WEGLD-d7c6bb';  // todo: move to config 
    const url = `${this.configService.getApiUrl()}/tokens?identifiers=${egldTicker},${tokenIdentifier}`;

    try {
      const response = await this.apiService.get(url);

      if (response.data.length !== 2) throw new Error();

      const result = {
        egldPrice: 0,
        tokenPrice: 0,
        tokenDecimals: 0,
      };

      response.data.forEach((element: any) => {
        if (element.identifier === egldTicker) {
          result.egldPrice = element.price;
        } else {
          result.tokenPrice = element.price;
          result.tokenDecimals = element.decimals;
        }
      });

      return result;
    } catch (error) {
      throw new BadRequestException('Invalid token identifier');
    }
  }
}
