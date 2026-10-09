import type { TripExpenseCategory } from "@/features/trips";

export type ExpenseActionTarget = {
  expenseId: string;
};

export type ExpenseInputDefaults = {
  amount?: string;
  category?: TripExpenseCategory;
  dayId?: string;
  note?: string;
  placeId?: string;
  title?: string;
};
