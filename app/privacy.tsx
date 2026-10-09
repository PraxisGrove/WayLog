import { useLocalSearchParams } from "expo-router";

import { PrivacyScreen } from "@/domains/settings/screens/privacy/privacy-screen";

type PrivacyRouteParams = {
  doc?: string | string[];
};

function normalizeRouteParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PrivacyRoute() {
  const params = useLocalSearchParams<PrivacyRouteParams>();

  return <PrivacyScreen doc={normalizeRouteParam(params.doc)} />;
}
