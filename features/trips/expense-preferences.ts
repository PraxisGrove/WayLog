import type { CloudSyncSession } from "./cloud-sync";
import {
  fetchCloudPreferenceRow,
  upsertCloudPreferenceRow,
} from "./cloud-sync";
import {
  DEFAULT_TRIP_CURRENCY_CODE,
  defaultPinnedExpenseCategories,
  normalizeTripCurrencyCode,
  tripExpenseWarningRatioOptions,
} from "./currency";
import { tripExpenseCategories } from "./expenses";
import type { TripExpenseCategory } from "./types";
import {
  createPreferenceSync,
  type PreferenceCloudAdapter,
  type PreferenceStorageAdapter,
} from "./unified-preferences";

export const TRIP_EXPENSE_PREFERENCE_STORAGE_KEY =
  "waylog.preferences.expense.v1";

export type TripExpensePreference = {
  budgetWarningRatio: number;
  defaultCurrency: string;
  pinnedCategories: TripExpenseCategory[];
};

export const defaultTripExpensePreference: TripExpensePreference = {
  budgetWarningRatio: 0.8,
  defaultCurrency: DEFAULT_TRIP_CURRENCY_CODE,
  pinnedCategories: defaultPinnedExpenseCategories,
};

function normalizeBudgetWarningRatio(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultTripExpensePreference.budgetWarningRatio;
  }

  return tripExpenseWarningRatioOptions.includes(
    value as (typeof tripExpenseWarningRatioOptions)[number],
  )
    ? value
    : defaultTripExpensePreference.budgetWarningRatio;
}

function normalizePinnedCategories(value: unknown): TripExpenseCategory[] {
  if (!Array.isArray(value)) {
    return defaultTripExpensePreference.pinnedCategories;
  }

  const normalizedCategories = value.filter(
    (category): category is TripExpenseCategory =>
      tripExpenseCategories.includes(category as TripExpenseCategory),
  );

  if (normalizedCategories.length === 0) {
    return defaultTripExpensePreference.pinnedCategories;
  }

  const uniqueCategories: TripExpenseCategory[] = [];

  normalizedCategories.forEach((category) => {
    if (!uniqueCategories.includes(category)) {
      uniqueCategories.push(category);
    }
  });

  return uniqueCategories;
}

export function normalizeTripExpensePreference(
  value: unknown,
): TripExpensePreference {
  if (typeof value !== "object" || value === null) {
    return defaultTripExpensePreference;
  }

  const source = value as Record<string, unknown>;

  return {
    budgetWarningRatio: normalizeBudgetWarningRatio(source.budgetWarningRatio),
    defaultCurrency: normalizeTripCurrencyCode(source.defaultCurrency),
    pinnedCategories: normalizePinnedCategories(source.pinnedCategories),
  };
}

const expensePreferenceSync = createPreferenceSync<TripExpensePreference>({
  storageKey: TRIP_EXPENSE_PREFERENCE_STORAGE_KEY,
  defaultValue: defaultTripExpensePreference,
  normalize: normalizeTripExpensePreference,
  fetchCloudRow: (session: CloudSyncSession) =>
    fetchCloudPreferenceRow(session, "expense"),
  upsertCloudRow: (
    session: CloudSyncSession,
    preference: TripExpensePreference,
  ) => upsertCloudPreferenceRow(session, "expense", preference),
});

export function setTripExpensePreferenceStorageAdapterForTests(
  adapter: PreferenceStorageAdapter | null,
): void {
  expensePreferenceSync.setStorageAdapterForTests(adapter);
}

export function setTripExpensePreferenceCloudAdapterForTests(
  adapter: PreferenceCloudAdapter | null,
): void {
  expensePreferenceSync.setCloudAdapterForTests(adapter);
}

export async function clearLocalTripExpensePreference(): Promise<void> {
  await expensePreferenceSync.clear();
}

export async function hasLocalGuestTripExpensePreferenceData(): Promise<boolean> {
  return expensePreferenceSync.hasGuestData();
}

export async function syncTripExpensePreferenceWithCloud(): Promise<TripExpensePreference> {
  return expensePreferenceSync.sync();
}

export async function getTripExpensePreference(): Promise<TripExpensePreference> {
  return expensePreferenceSync.get();
}

export async function saveTripExpensePreference(
  preference: TripExpensePreference,
): Promise<void> {
  await expensePreferenceSync.save(preference);
}

export function sortTripExpenseCategoriesByPreference(
  categories: TripExpenseCategory[],
  preference: TripExpensePreference,
): TripExpenseCategory[] {
  const pinnedCategorySet = new Set(preference.pinnedCategories);
  const pinnedCategories = preference.pinnedCategories.filter((category) =>
    categories.includes(category),
  );
  const remainingCategories = categories.filter(
    (category) => !pinnedCategorySet.has(category),
  );

  return [...pinnedCategories, ...remainingCategories];
}
