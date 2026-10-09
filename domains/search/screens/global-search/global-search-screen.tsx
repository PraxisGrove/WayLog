import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  type GlobalSearchScope,
  searchTripsForGlobalSearch,
  type TripGlobalSearchResult,
} from "@/features/search";
import { getTripsWithSeed, type Trip } from "@/features/trips";
import { FavoritePlaceSearchPanel } from "@/shared/places/favorite-place-search-panel";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { EmptyState } from "@/shared/ui/empty-state";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";
import { ScreenContent } from "@/shared/ui/screen-content";
import { ScreenHeader } from "@/shared/ui/screen-header";

const globalSearchScreenLogger = createDiagnosticLogger("global-search-screen");
type SearchScopeOption = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  scope: GlobalSearchScope;
};

const searchScopeOptions: SearchScopeOption[] = [
  { icon: "place", label: "地点", scope: "places" },
  { icon: "card-travel", label: "行程", scope: "trips" },
  { icon: "person-search", label: "用户", scope: "users" },
];

type SearchScopeTabsProps = {
  activeScope: GlobalSearchScope;
  onChange: (scope: GlobalSearchScope) => void;
};

function SearchScopeSelect({ activeScope, onChange }: SearchScopeTabsProps) {
  const theme = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);
  const activeOption =
    searchScopeOptions.find((option) => option.scope === activeScope) ??
    searchScopeOptions[0];

  return (
    <View style={styles.scopeSelectWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((value) => !value)}
        style={({ pressed }) => [
          styles.scopeSelectButton,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isOpen ? theme.colors.primary : theme.colors.border,
          },
          pressed && { backgroundColor: theme.colors.surfacePressed },
        ]}
      >
        <MaterialIcons
          name={activeOption.icon}
          size={16}
          color={theme.colors.primary}
        />
        <Text
          numberOfLines={1}
          style={[styles.scopeSelectText, { color: theme.colors.text }]}
        >
          {activeOption.label}
        </Text>
        <MaterialIcons
          name={isOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={18}
          color={theme.colors.textMuted}
        />
      </Pressable>

      {isOpen ? (
        <View
          style={[
            styles.scopeMenu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              shadowColor: theme.colors.text,
            },
          ]}
        >
          {searchScopeOptions.map((option) => {
            const isActive = activeScope === option.scope;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={option.scope}
                onPress={() => {
                  setIsOpen(false);
                  onChange(option.scope);
                }}
                style={({ pressed }) => [
                  styles.scopeMenuItem,
                  pressed && { backgroundColor: theme.colors.surfacePressed },
                ]}
              >
                <View style={styles.scopeMenuMain}>
                  <MaterialIcons
                    name={option.icon}
                    size={16}
                    color={
                      isActive ? theme.colors.primary : theme.colors.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.scopeMenuText,
                      {
                        color: isActive
                          ? theme.colors.primary
                          : theme.colors.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </View>
                {isActive ? (
                  <MaterialIcons
                    name="check"
                    size={16}
                    color={theme.colors.primary}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

type SearchHeaderProps = {
  onBack: () => void;
  subtitle: string;
};

function SearchHeader({ onBack, subtitle }: SearchHeaderProps) {
  return (
    <View style={styles.header}>
      <ScreenHeader onBack={onBack} subtitle={subtitle} title="搜索" />
    </View>
  );
}

type SearchInputProps = {
  onChangeText: (value: string) => void;
  placeholder: string;
  scopeControl?: ReactNode;
  value: string;
};

function SearchInput({
  onChangeText,
  placeholder,
  scopeControl,
  value,
}: SearchInputProps) {
  const theme = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <View style={styles.searchField}>
      <Animated.View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderBottomWidth: 0,
            borderColor: "transparent",
            borderLeftWidth: 0,
            borderRightWidth: 0,
            borderTopWidth: 0,
          },
        ]}
      >
        {scopeControl ? (
          <>
            {scopeControl}
            <View
              style={[
                styles.searchDivider,
                { backgroundColor: theme.colors.borderStrong },
              ]}
            />
          </>
        ) : null}
        <View style={styles.searchInputWrap}>
          <MaterialIcons
            name="search"
            size={18}
            color={isFocused ? theme.colors.primary : theme.colors.textMuted}
          />
          <TextInput
            autoFocus
            clearButtonMode="while-editing"
            onBlur={handleBlur}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSubtle}
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.colors.text }]}
            value={value}
          />
        </View>
        {value ? (
          <Pressable
            accessibilityLabel="清除搜索"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onChangeText("")}
            style={({ pressed }) => [
              styles.clearSearchButton,
              pressed && { backgroundColor: theme.colors.surfacePressed },
            ]}
          >
            <MaterialIcons
              name="close"
              size={18}
              color={theme.colors.textMuted}
            />
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

type SearchPageShellProps = {
  children: ReactNode;
  filterRail?: ReactNode;
  onBack: () => void;
  searchField: ReactNode;
  subtitle: string;
};

function SearchPageShell({
  children,
  filterRail,
  onBack,
  searchField,
  subtitle,
}: SearchPageShellProps) {
  return (
    <>
      <SearchHeader onBack={onBack} subtitle={subtitle} />
      <View style={styles.searchFieldSlot}>{searchField}</View>
      {filterRail ? (
        <View style={styles.filterRailSlot}>{filterRail}</View>
      ) : null}
      <View style={styles.resultViewport}>{children}</View>
    </>
  );
}

type TripResultsProps = {
  isLoading: boolean;
  onOpenTrip: (tripId: string) => void;
  query: string;
  results: TripGlobalSearchResult[];
};

function TripResults({
  isLoading,
  onOpenTrip,
  query,
  results,
}: TripResultsProps) {
  const theme = useAppTheme();
  const sectionTitle = query.trim() ? "行程结果" : "全部行程";

  if (isLoading) {
    return (
      <View
        style={[
          styles.centerCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={[styles.mutedText, { color: theme.colors.textMuted }]}>
          正在读取本地行程
        </Text>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <EmptyState
          description={
            query.trim()
              ? "换个关键词试试，或者回到行程列表新建一趟旅行。"
              : "输入行程名称、目的地或地点名称。"
          }
          icon="travel-explore"
          title={query.trim() ? "没有找到相关行程" : "搜索行程规划"}
        />
      </View>
    );
  }

  return (
    <View style={styles.resultStack}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
        {sectionTitle}
      </Text>
      {results.map((result, index) => (
        <Animated.View
          key={result.id}
          entering={FadeInDown.delay(index * 60).springify()}
        >
          <Pressable
            accessibilityHint="打开行程详情"
            accessibilityRole="button"
            onPress={() => {
              triggerHaptic("light");
              onOpenTrip(result.id);
            }}
            style={({ pressed }) => [
              styles.resultRow,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
              pressed && { backgroundColor: theme.colors.surfacePressed },
            ]}
          >
            <View
              style={[
                styles.resultIcon,
                { backgroundColor: theme.colors.primarySoft },
              ]}
            >
              <MaterialIcons
                name="card-travel"
                size={22}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.resultCopy}>
              <Text
                numberOfLines={1}
                style={[styles.resultTitle, { color: theme.colors.text }]}
              >
                {result.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.resultMeta, { color: theme.colors.textMuted }]}
              >
                {result.meta}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.resultDetail,
                  { color: theme.colors.textSubtle },
                ]}
              >
                {result.detail}
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={theme.colors.textSubtle}
            />
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

type UserResultsProps = {
  query: string;
};

function UserResults({ query }: UserResultsProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <EmptyState
        description={
          query.trim() ? "当前没有匹配的用户结果。" : "输入昵称或用户名。"
        }
        icon="person-search"
        title={query.trim() ? "没有找到用户" : "搜索用户"}
      />
    </View>
  );
}

type GlobalSearchScreenProps = {
  requestedScope: GlobalSearchScope;
};

export function GlobalSearchScreen({
  requestedScope,
}: GlobalSearchScreenProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const [activeScope, setActiveScope] =
    useState<GlobalSearchScope>(requestedScope);
  const [query, setQuery] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setLoadingTrips] = useState(true);
  const [tripError, setTripError] = useState("");

  useEffect(() => {
    setActiveScope(requestedScope);
  }, [requestedScope]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadTrips = async () => {
        setLoadingTrips(true);
        setTripError("");

        try {
          const localTrips = await getTripsWithSeed();

          if (isActive) {
            setTrips(localTrips);
          }
        } catch (loadError) {
          globalSearchScreenLogger.warn(
            "legacy.warn",
            { args: ["Failed to load trips for global search.", loadError] },
            "Legacy warning captured",
          );

          if (isActive) {
            setTripError("读取行程失败，请稍后再试");
          }
        } finally {
          if (isActive) {
            setLoadingTrips(false);
          }
        }
      };

      void loadTrips();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const tripResults = useMemo(
    () => searchTripsForGlobalSearch(trips, query),
    [query, trips],
  );

  const goBack = () => {
    router.back();
  };

  const changeScope = (scope: GlobalSearchScope) => {
    setActiveScope(scope);
    router.setParams({ scope });
  };

  const openTrip = (tripId: string) => {
    router.push({
      pathname: "/trips/[id]",
      params: { id: tripId },
    });
  };

  const renderScopeContent = () => {
    const scopeControl = (
      <SearchScopeSelect activeScope={activeScope} onChange={changeScope} />
    );

    if (activeScope === "places") {
      return (
        <FavoritePlaceSearchPanel
          backLabel="搜索"
          onClose={goBack}
          renderSearchChrome={({
            categoryRail,
            resultViewport,
            searchField,
          }) => (
            <SearchPageShell
              filterRail={categoryRail}
              onBack={goBack}
              searchField={searchField}
              subtitle="搜索景点、餐厅、酒店"
            >
              {resultViewport}
            </SearchPageShell>
          )}
          searchPrefix={scopeControl}
          showHeader={false}
          subtitle="搜索景点、餐厅、酒店"
          title="搜索"
        />
      );
    }

    const subtitle =
      activeScope === "trips" ? "搜索行程名称、目的地" : "搜索用户昵称";

    return (
      <SearchPageShell
        onBack={goBack}
        searchField={
          <SearchInput
            onChangeText={setQuery}
            placeholder={subtitle}
            scopeControl={scopeControl}
            value={query}
          />
        }
        subtitle={subtitle}
      >
        {tripError ? (
          <View
            style={[
              styles.inlineError,
              {
                backgroundColor: theme.colors.dangerSoft,
                borderColor: theme.colors.dangerBorder,
              },
            ]}
          >
            <Text
              style={[styles.inlineErrorText, { color: theme.colors.danger }]}
            >
              {tripError}
            </Text>
          </View>
        ) : null}
        <ScrollView
          contentContainerStyle={styles.scrollResults}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.resultScroller}
        >
          {activeScope === "trips" ? (
            <TripResults
              isLoading={isLoadingTrips}
              onOpenTrip={openTrip}
              query={query}
              results={tripResults}
            />
          ) : (
            <UserResults query={query} />
          )}
        </ScrollView>
      </SearchPageShell>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={16}
        style={styles.keyboardRoot}
      >
        <ScreenContent style={styles.content}>
          {renderScopeContent()}
        </ScreenContent>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardRoot: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 20,
    paddingTop: 6,
  },
  header: {
    gap: 12,
    paddingBottom: 10,
    paddingTop: 8,
  },
  scopeSelectWrap: {
    zIndex: 10,
  },
  scopeSelectButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 0,
  },
  scopeSelectText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scopeMenu: {
    position: "absolute",
    top: 40,
    left: 0,
    minWidth: 112,
    borderRadius: 12,
    borderWidth: 0,
    paddingVertical: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  scopeMenuItem: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
  },
  scopeMenuMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scopeMenuText: {
    fontSize: 14,
    fontWeight: "600",
  },
  searchField: {
    position: "relative",
    zIndex: 9,
  },
  searchFieldSlot: {
    position: "relative",
    zIndex: 9,
  },
  filterRailSlot: {
    flexShrink: 0,
  },
  resultViewport: {
    flex: 1,
    minHeight: 0,
  },
  searchBox: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0,
    boxShadow: "none",
    outlineWidth: 0,
  },
  searchDivider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 4,
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    fontSize: 16,
    fontWeight: "600",
    outlineStyle: "solid",
    outlineWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  clearSearchButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  inlineError: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  inlineErrorText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  resultScroller: {
    flex: 1,
  },
  scrollResults: {
    gap: 10,
    paddingBottom: 24,
    paddingTop: 14,
  },
  centerCard: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 8,
    borderWidth: 0,
  },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 8,
    borderWidth: 0,
  },
  mutedText: {
    fontSize: 14,
    lineHeight: 20,
  },
  resultStack: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  resultRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 0,
  },
  resultIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  resultMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  resultDetail: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
});
