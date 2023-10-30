import { TransactionDetails } from "./transaction.details";

export class GenerateRelayedTxDto {
  transaction!: TransactionDetails;

  shouldSubmit: boolean = true;
}
