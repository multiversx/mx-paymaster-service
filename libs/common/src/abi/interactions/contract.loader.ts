import { SmartContract, AbiRegistry, Address } from "@multiversx/sdk-core";
import { Logger } from "@nestjs/common";

export class ContractLoader {
  private readonly logger: Logger;
  private readonly jsonString: string;
  private contract: SmartContract | undefined = undefined;

  constructor(jsonString: string) {
    this.jsonString = jsonString;

    this.logger = new Logger(ContractLoader.name);
  }

  private load(contractAddress: string): SmartContract {
    try {
      const json = JSON.parse(this.jsonString);

      const abiRegistry = AbiRegistry.create(json);

      return new SmartContract({
        address: new Address(contractAddress),
        abi: abiRegistry,
      });
    } catch (error) {
      this.logger.log(`Unexpected error when trying to create smart contract from abi`);
      this.logger.error(error);

      throw new Error('Error when creating contract from abi');
    }
  }

  getContract(contractAddress: string): SmartContract {
    if (!this.contract) {
      this.contract = this.load(contractAddress);
    }

    return this.contract;
  }
}
