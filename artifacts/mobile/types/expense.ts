export type ExpenseCategory = 'kraftstoff' | 'wartung' | 'parkgebuehr' | 'sonstiges';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
  receiptUri?: string;
  linkedTripId?: string;
  note?: string;
  createdAt: string;
}
