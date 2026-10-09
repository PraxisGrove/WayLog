import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing } from "react-native";
import {
  clearTripBudget as clearTripBudgetCommand,
  defaultTripExpensePreference,
  formatExpenseAmount,
  formatExpenseInputValue,
  getPlaceForTripDayItem,
  getSortedTripDayItems,
  getTripDayExpenseTotal,
  getTripExpenseEntriesForDay,
  getTripExpensePreference,
  getTripExpenseSummary,
  getTripTotalCost,
  inferExpenseCategoryFromPlaceCategory,
  parseExpenseAmountInput,
  removeTripExpense as removeTripExpenseCommand,
  setTripBudget as setTripBudgetCommand,
  sortTripExpenseCategoriesByPreference,
  type Trip,
  type TripDay,
  type TripDayItem,
  type TripExpenseCategory,
  type TripPlace,
  tripExpenseCategories,
  upsertTripExpense as upsertTripExpenseCommand,
} from "@/features/trips";
import type {
  ExpenseActionTarget,
  ExpenseInputDefaults,
} from "../../ledger/types";
import { createDiagnosticLogger } from "@/features/diagnostics";
const tripLedgerLogger = createDiagnosticLogger("trip-ledger");
type PersistTripUpdate = (
  nextTrip: Trip,
  fallbackTrip: Trip,
  errorMessage?: string,
) => Promise<boolean>;

type UseTripLedgerParams = {
  persistTripUpdate: PersistTripUpdate;
  requestedAction?: string;
  selectedDay?: TripDay;
  setActionError: Dispatch<SetStateAction<string>>;
  trip: Trip | null;
};

export function useTripLedger({
  persistTripUpdate,
  requestedAction,
  selectedDay,
  setActionError,
  trip,
}: UseTripLedgerParams) {
  const requestedExpenseActionHandledRef = useRef(false);
  const expenseLedgerModalAnim = useRef(new Animated.Value(0)).current;

  const [isAddingExpense, setAddingExpense] = useState(false);
  const [isEditingBudget, setEditingBudget] = useState(false);
  const [isExpenseLedgerOpen, setExpenseLedgerOpen] = useState(false);
  const [activeExpenseCategoryFilter, setActiveExpenseCategoryFilter] =
    useState<TripExpenseCategory | undefined>();
  const [activeExpenseTarget, setActiveExpenseTarget] = useState<
    ExpenseActionTarget | undefined
  >();
  const [isConfirmingExpenseDelete, setConfirmingExpenseDelete] =
    useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] =
    useState<TripExpenseCategory>("餐饮");
  const [expenseDayId, setExpenseDayId] = useState("");
  const [expensePlaceId, setExpensePlaceId] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetError, setBudgetError] = useState("");
  const [expensePreference, setExpensePreference] = useState(
    defaultTripExpensePreference,
  );
  const [expandedExpenseDayIds, setExpandedExpenseDayIds] = useState<
    Record<string, boolean>
  >({});

  const activeExpenseAction = useMemo(() => {
    if (!trip || !activeExpenseTarget) {
      return undefined;
    }

    return trip.expenses.find(
      (expense) => expense.id === activeExpenseTarget.expenseId,
    );
  }, [activeExpenseTarget, trip]);

  const expensePlaceOptions = useMemo(() => {
    if (!trip) {
      return [];
    }

    const sourceDays = expenseDayId
      ? trip.days.filter((day) => day.id === expenseDayId)
      : trip.days;
    const seenPlaceIds = new Set<string>();

    return sourceDays.flatMap((day) =>
      getSortedTripDayItems(day.items)
        .map((item) => {
          const place = getPlaceForTripDayItem(trip, item);
          const placeId = place?.id ?? item.placeId;
          const placeName = item.placeName ?? place?.name ?? item.title;

          if (!placeId || seenPlaceIds.has(placeId)) {
            return undefined;
          }

          seenPlaceIds.add(placeId);
          return {
            day,
            item,
            placeId,
            placeName,
          };
        })
        .filter(
          (
            option,
          ): option is {
            day: TripDay;
            item: TripDayItem;
            placeId: string;
            placeName: string;
          } => Boolean(option),
        ),
    );
  }, [expenseDayId, trip]);

  const selectedExpensePlaceOption = useMemo(
    () =>
      expensePlaceOptions.find((option) => option.placeId === expensePlaceId),
    [expensePlaceId, expensePlaceOptions],
  );

  useEffect(() => {
    if (expensePlaceId && !selectedExpensePlaceOption) {
      setExpensePlaceId("");
    }
  }, [expensePlaceId, selectedExpensePlaceOption]);

  const tripTotalCost = useMemo(
    () => (trip ? getTripTotalCost(trip) : 0),
    [trip],
  );
  const expenseSummary = useMemo(
    () => (trip ? getTripExpenseSummary(trip) : undefined),
    [trip],
  );
  const expensePreviewEntries = expenseSummary?.entries ?? [];

  const filteredExpenseEntries = useMemo(
    () =>
      activeExpenseCategoryFilter
        ? (expenseSummary?.entries ?? []).filter(
            (entry) => entry.category === activeExpenseCategoryFilter,
          )
        : (expenseSummary?.entries ?? []),
    [activeExpenseCategoryFilter, expenseSummary],
  );

  const unassignedExpenseEntries = useMemo(
    () => filteredExpenseEntries.filter((entry) => !entry.dayId),
    [filteredExpenseEntries],
  );
  const unassignedExpenseTotal = useMemo(
    () =>
      unassignedExpenseEntries.reduce(
        (total, entry) => total + entry.amount,
        0,
      ),
    [unassignedExpenseEntries],
  );

  const expenseBudgetProgress = useMemo(() => {
    if (!expenseSummary?.budgetAmount || expenseSummary.budgetAmount <= 0) {
      return undefined;
    }

    return Math.min(
      100,
      Math.round(
        (expenseSummary.totalAmount / expenseSummary.budgetAmount) * 100,
      ),
    );
  }, [expenseSummary]);

  const expenseBudgetStatusText = useMemo(() => {
    if (!expenseSummary?.budgetAmount) {
      return "还没有设置预算";
    }

    const remainingAmount = expenseSummary.remainingAmount ?? 0;
    if (remainingAmount < 0) {
      return `已超出 ${formatExpenseAmount(Math.abs(remainingAmount), trip?.currency)}`;
    }

    return `剩余 ${formatExpenseAmount(remainingAmount, trip?.currency)}`;
  }, [expenseSummary, trip?.currency]);

  const getFilteredExpenseEntriesForDay = useCallback(
    (day: TripDay) =>
      activeExpenseCategoryFilter
        ? filteredExpenseEntries.filter((entry) => entry.dayId === day.id)
        : trip
          ? getTripExpenseEntriesForDay(trip, day)
          : [],
    [activeExpenseCategoryFilter, filteredExpenseEntries, trip],
  );

  const getFilteredTripDayExpenseTotal = useCallback(
    (day: TripDay) =>
      activeExpenseCategoryFilter
        ? filteredExpenseEntries
            .filter((entry) => entry.dayId === day.id)
            .reduce((total, entry) => total + entry.amount, 0)
        : trip
          ? getTripDayExpenseTotal(trip, day)
          : 0,
    [activeExpenseCategoryFilter, filteredExpenseEntries, trip],
  );

  const expenseLedgerDays = useMemo(() => {
    if (!trip) {
      return [];
    }

    return trip.days
      .map((day) => {
        const entries = getFilteredExpenseEntriesForDay(day);

        return {
          day,
          entries,
          totalAmount: getFilteredTripDayExpenseTotal(day),
        };
      })
      .filter(
        ({ entries }) => !activeExpenseCategoryFilter || entries.length > 0,
      );
  }, [
    activeExpenseCategoryFilter,
    getFilteredExpenseEntriesForDay,
    getFilteredTripDayExpenseTotal,
    trip,
  ]);

  const orderedExpenseCategories = useMemo(
    () =>
      sortTripExpenseCategoriesByPreference(
        tripExpenseCategories,
        expensePreference,
      ),
    [expensePreference],
  );

  useEffect(() => {
    let isActive = true;

    void getTripExpensePreference()
      .then((preference) => {
        if (isActive) {
          setExpensePreference(preference);
        }
      })
      .catch((preferenceError) => {
        tripLedgerLogger.warn(
          "legacy.warn",
          { args: ["Failed to load expense preference.", preferenceError] },
          "Legacy warning captured",
        );
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isExpenseLedgerOpen) {
      return;
    }

    expenseLedgerModalAnim.setValue(0);
    Animated.timing(expenseLedgerModalAnim, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [expenseLedgerModalAnim, isExpenseLedgerOpen]);

  const openExpenseInput = useCallback(
    (defaults: ExpenseInputDefaults = {}) => {
      setActiveExpenseTarget(undefined);
      setConfirmingExpenseDelete(false);
      setExpenseTitle(defaults.title ?? "");
      setExpenseAmount(defaults.amount ?? "");
      setExpenseCategory(
        defaults.category ?? expensePreference.pinnedCategories[0] ?? "餐饮",
      );
      setExpenseDayId(
        defaults.dayId ?? selectedDay?.id ?? trip?.days[0]?.id ?? "",
      );
      setExpensePlaceId(defaults.placeId ?? "");
      setExpenseNote(defaults.note ?? "");
      setExpenseError("");
      setAddingExpense(true);
      setActionError("");
    },
    [
      expensePreference.pinnedCategories,
      selectedDay?.id,
      setActionError,
      trip?.days,
    ],
  );

  useEffect(() => {
    if (requestedAction !== "expense") {
      requestedExpenseActionHandledRef.current = false;
      return;
    }

    if (trip && !requestedExpenseActionHandledRef.current) {
      requestedExpenseActionHandledRef.current = true;
      openExpenseInput();
    }
  }, [openExpenseInput, requestedAction, trip]);

  const openExpenseInputForDayItem = (
    day: TripDay,
    item: TripDayItem,
    place?: TripPlace,
  ) => {
    openExpenseInput({
      category: inferExpenseCategoryFromPlaceCategory(item.category),
      dayId: day.id,
      placeId: place?.id ?? item.placeId ?? "",
      title: item.placeName ?? place?.name ?? item.title,
    });
  };

  const openExpenseLedger = () => {
    if (!trip) {
      return;
    }

    setExpandedExpenseDayIds((currentIds) => {
      if (Object.keys(currentIds).length > 0) {
        return currentIds;
      }

      const nextIds: Record<string, boolean> = {};
      for (const day of trip.days) {
        if (getTripExpenseEntriesForDay(trip, day).length > 0) {
          nextIds[day.id] = true;
        }
      }

      return nextIds;
    });
    setExpenseLedgerOpen(true);
    setActionError("");
  };

  const closeExpenseLedger = () => {
    Animated.timing(expenseLedgerModalAnim, {
      duration: 160,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setExpenseLedgerOpen(false);
        setActiveExpenseCategoryFilter(undefined);
      }
    });
  };

  const toggleExpenseCategoryFilter = (category: TripExpenseCategory) => {
    setActiveExpenseCategoryFilter((currentCategory) =>
      currentCategory === category ? undefined : category,
    );
  };

  const toggleExpenseDay = (dayId: string) => {
    setExpandedExpenseDayIds((currentIds) => ({
      ...currentIds,
      [dayId]: !currentIds[dayId],
    }));
  };

  const closeExpenseInput = () => {
    setActiveExpenseTarget(undefined);
    setConfirmingExpenseDelete(false);
    setExpenseTitle("");
    setExpenseAmount("");
    setExpenseCategory(expensePreference.pinnedCategories[0] ?? "餐饮");
    setExpenseDayId("");
    setExpensePlaceId("");
    setExpenseNote("");
    setExpenseError("");
    setBudgetError("");
    setAddingExpense(false);
  };

  const openBudgetInput = () => {
    setBudgetAmount(formatExpenseInputValue(trip?.budget?.amount));
    setBudgetError("");
    setEditingBudget(true);
    setActionError("");
  };

  const closeBudgetInput = () => {
    setBudgetAmount("");
    setBudgetError("");
    setEditingBudget(false);
  };

  const saveBudget = async () => {
    if (!trip) {
      return;
    }

    const parsedBudget = parseExpenseAmountInput(budgetAmount);

    if (parsedBudget.error) {
      setBudgetError(parsedBudget.error);
      return;
    }

    const result = setTripBudgetCommand(trip, {
      amount: parsedBudget.amount,
      currency: trip.currency,
    });

    if (!result.ok) {
      setBudgetError(result.error.message);
      return;
    }

    closeBudgetInput();
    await persistTripUpdate(result.data.trip, trip, "更新预算失败，请稍后再试");
  };

  const clearBudget = async () => {
    if (!trip) {
      return;
    }

    const result = clearTripBudgetCommand(trip);

    if (!result.ok) {
      setBudgetError(result.error.message);
      return;
    }

    closeBudgetInput();
    await persistTripUpdate(result.data.trip, trip, "清除预算失败，请稍后再试");
  };

  const openExpenseActions = (expenseId: string) => {
    setActiveExpenseTarget({ expenseId });
    setConfirmingExpenseDelete(false);
    setAddingExpense(false);
    setExpenseError("");
    setActionError("");
  };

  const closeExpenseActions = () => {
    setActiveExpenseTarget(undefined);
    setConfirmingExpenseDelete(false);
    setAddingExpense(false);
    setExpenseError("");
  };

  const startEditingExpense = () => {
    if (!activeExpenseAction) {
      return;
    }

    setExpenseTitle(activeExpenseAction.title);
    setExpenseAmount(formatExpenseInputValue(activeExpenseAction.amount));
    setExpenseCategory(activeExpenseAction.category);
    setExpenseDayId(activeExpenseAction.dayId ?? "");
    setExpensePlaceId(activeExpenseAction.placeId ?? "");
    setExpenseNote(activeExpenseAction.note ?? "");
    setExpenseError("");
    setConfirmingExpenseDelete(false);
    setAddingExpense(true);
  };

  const saveExpense = async () => {
    if (!trip) {
      return;
    }

    const trimmedTitle = expenseTitle.trim();
    const trimmedAmount = expenseAmount.trim();
    const trimmedNote = expenseNote.trim();
    const parsedExpense = parseExpenseAmountInput(expenseAmount);

    if (parsedExpense.error) {
      setExpenseError(parsedExpense.error);
      return;
    }

    if (!trimmedAmount) {
      setExpenseError("请先填写开销金额");
      return;
    }

    if (parsedExpense.amount === undefined) {
      setExpenseError("请填写有效金额");
      return;
    }

    const result = upsertTripExpenseCommand(trip, {
      amount: parsedExpense.amount,
      category: expenseCategory,
      dayId: expenseDayId || undefined,
      expenseId: activeExpenseAction?.id,
      note: trimmedNote,
      placeId: selectedExpensePlaceOption?.placeId,
      placeName: selectedExpensePlaceOption?.placeName,
      title: trimmedTitle,
    });

    if (!result.ok) {
      setExpenseError(result.error.message);
      return;
    }

    closeExpenseInput();
    await persistTripUpdate(
      result.data.trip,
      trip,
      activeExpenseAction
        ? "更新开销失败，请稍后再试"
        : "记录开销失败，请稍后再试",
    );
  };

  const deleteActiveExpense = async () => {
    if (!trip || !activeExpenseAction) {
      return;
    }

    const result = removeTripExpenseCommand(trip, {
      expenseId: activeExpenseAction.id,
    });

    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }

    closeExpenseActions();
    await persistTripUpdate(result.data.trip, trip, "删除开销失败，请稍后再试");
  };

  return {
    activeExpenseAction,
    activeExpenseCategoryFilter,
    budgetAmount,
    budgetError,
    clearBudget,
    closeBudgetInput,
    closeExpenseActions,
    closeExpenseInput,
    closeExpenseLedger,
    deleteActiveExpense,
    expandedExpenseDayIds,
    expenseAmount,
    expenseBudgetProgress,
    expenseBudgetStatusText,
    expenseCategory,
    expenseDayId,
    expenseError,
    expenseLedgerDays,
    expenseLedgerModalAnim,
    expenseNote,
    expensePlaceId,
    expensePlaceOptions,
    expensePreviewEntries,
    expenseSummary,
    expenseTitle,
    filteredExpenseEntries,
    isAddingExpense,
    isConfirmingExpenseDelete,
    isEditingBudget,
    isExpenseLedgerOpen,
    openBudgetInput,
    openExpenseActions,
    openExpenseInput,
    openExpenseInputForDayItem,
    openExpenseLedger,
    orderedExpenseCategories,
    saveBudget,
    saveExpense,
    setActiveExpenseCategoryFilter,
    setBudgetAmount,
    setBudgetError,
    setConfirmingExpenseDelete,
    setExpenseAmount,
    setExpenseCategory,
    setExpenseDayId,
    setExpenseError,
    setExpenseNote,
    setExpensePlaceId,
    setExpenseTitle,
    startEditingExpense,
    toggleExpenseCategoryFilter,
    toggleExpenseDay,
    tripTotalCost,
    unassignedExpenseEntries,
    unassignedExpenseTotal,
  };
}
