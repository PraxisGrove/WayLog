import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FavoritePlaceSearchPanel } from "@/shared/places/favorite-place-search-panel";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ScreenContent } from "@/shared/ui/screen-content";

export function FavoritePlaceSearchScreen() {
  const router = useRouter();
  const theme = useAppTheme();

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
          <FavoritePlaceSearchPanel onClose={() => router.back()} />
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
    paddingTop: 8,
  },
});
