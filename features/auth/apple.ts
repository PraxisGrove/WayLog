import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

export type AppleCredential = {
  identityToken: string;
  user: string;
  email?: string | null;
  fullName?: AppleAuthentication.AppleAuthenticationFullName | null;
};

export async function isAppleLoginAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") {
    return false;
  }

  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getAppleCredential(): Promise<AppleCredential | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return null;
    }

    return {
      identityToken: credential.identityToken,
      user: credential.user,
      email: credential.email,
      fullName: credential.fullName,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const appleError = error as { code: number };

      if (appleError.code === 1001) {
        return null;
      }
    }

    throw error;
  }
}
