import { Tabs } from "expo-router";
import { skinSlotAdapterIds } from "@/shared/theme/skin-slot-registry";
import type { ShellTabBarPresetId } from "@/shared/theme/types";
import {
  useShellTabBarPreset,
  useSkinSlot,
} from "@/shared/theme/use-app-theme";
import { ShellTabBar } from "./components/shell-tab-bar";

function resolveShellTabBarPreset(
  adapterId: string,
  fallbackPreset: ShellTabBarPresetId,
): ShellTabBarPresetId {
  // Agent 已经成为第三个一级 Tab，三 Tab 结构下统一使用右侧浮动加号，
  // 避免旧 centerAdd 形态把快捷添加按钮插在主导航项中间。
  switch (adapterId) {
    case skinSlotAdapterIds.shellTabBar.classic:
      return "rightFab";
    case skinSlotAdapterIds.shellTabBar.default:
      return "rightFab";
    default:
      return fallbackPreset === "centerAdd" ? "rightFab" : fallbackPreset;
  }
}

function renderShellTabBar(tabBarPreset: ShellTabBarPresetId) {
  switch (tabBarPreset) {
    case "centerAdd":
      return <ShellTabBar preset="centerAdd" />;
    case "rightFab":
      return <ShellTabBar preset="rightFab" />;
  }
}

export function AppTabLayout() {
  const { resolvedShellTabBarPreset } = useShellTabBarPreset();
  const shellTabBarSlot = useSkinSlot("shell.tabBar");
  const shellTabBarPreset = resolveShellTabBarPreset(
    shellTabBarSlot.adapterId,
    resolvedShellTabBarPreset,
  );

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            display: "none",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "行程",
          }}
        />
        <Tabs.Screen
          name="agent"
          options={{
            title: "规划",
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "我的",
          }}
        />
      </Tabs>

      {renderShellTabBar(shellTabBarPreset)}
    </>
  );
}
