import { TransactionDetails } from "./transaction.details";

export class GeneratePaymasterTxDto {
  transaction!: TransactionDetails;

  token!: string;
}
