import * as Sentry from "@sentry/react-native";
import { initializePersistentAppLogger } from "@/features/diagnostics";
import { AppRootLayout } from "@/shell/app-root-layout";

initializePersistentAppLogger();

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutRoute() {
  return <AppRootLayout />;
}

export default Sentry.wrap(RootLayoutRoute);
