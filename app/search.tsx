import { useLocalSearchParams } from "expo-router";
import { GlobalSearchScreen } from "@/domains/search/screens/global-search/global-search-screen";
import { normalizeGlobalSearchScope } from "@/features/search";

type SearchRouteParams = {
  scope?: string | string[];
};

function normalizeRouteParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function SearchRoute() {
  const params = useLocalSearchParams<SearchRouteParams>();

  return (
    <GlobalSearchScreen
      requestedScope={normalizeGlobalSearchScope(
        normalizeRouteParam(params.scope),
      )}
    />
  );
}
