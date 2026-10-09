import { requireOptionalNativeModule } from "expo-modules-core";

import { type AppIconPatternId, getAppIconName } from "./app-icon";

type WaylogAppIconNativeModule = {
  setIconAsync: (iconName: string) => Promise<boolean>;
};

const nativeModule =
  requireOptionalNativeModule<WaylogAppIconNativeModule>("WaylogAppIcon");

export function isAppIconSwitchingSupported(): boolean {
  return Boolean(nativeModule);
}

export async function applyAppIcon(
  themeColorId: string,
  patternId: AppIconPatternId,
): Promise<boolean> {
  if (!nativeModule) {
    return false;
  }

  return nativeModule.setIconAsync(getAppIconName(themeColorId, patternId));
}
