import { NativeModules, Platform } from "react-native";

import { createDiagnosticLogger } from "../diagnostics";

type WechatAuthResponse = {
  code?: string;
  errCode: number;
  errStr?: string;
  state?: string;
};

type WechatSdk = {
  getApiVersion: () => Promise<string>;
  handleWechatCallback: () => Promise<boolean>;
  isWXAppInstalled: () => Promise<boolean>;
  registerApp: (appId: string, universalLink: string) => Promise<boolean>;
  sendAuthRequest: (
    scope: string,
    state: string,
  ) => Promise<WechatAuthResponse>;
};

function isWechatSdk(value: unknown): value is WechatSdk {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<keyof WechatSdk, unknown>;
  return (
    typeof candidate.getApiVersion === "function" &&
    typeof candidate.handleWechatCallback === "function" &&
    typeof candidate.isWXAppInstalled === "function" &&
    typeof candidate.registerApp === "function" &&
    typeof candidate.sendAuthRequest === "function"
  );
}

let WechatLib: WechatSdk | null = null;

let hasAttemptedLoad = false;

let nativeModuleAvailable: boolean | null = null;

let registeredAppId: string | null = null;

let initializationPromise: Promise<boolean> | null = null;

const wechatLogger = createDiagnosticLogger("wechat");

function isNativeModuleAvailable(): boolean {
  if (nativeModuleAvailable !== null) {
    return nativeModuleAvailable;
  }

  try {
    const wechatModule = NativeModules.WeChat || NativeModules.RCTWeChat;
    nativeModuleAvailable =
      wechatModule != null && typeof wechatModule === "object";
  } catch {
    nativeModuleAvailable = false;
  }

  return nativeModuleAvailable;
}

function getWechatLib(): WechatSdk | null {
  if (hasAttemptedLoad) {
    return WechatLib;
  }

  hasAttemptedLoad = true;

  if (!isNativeModuleAvailable()) {
    wechatLogger.warn(
      "native-module.unavailable",
      { platform: Platform.OS },
      "Wechat native module is unavailable",
    );
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: unknown = require("react-native-wechat-lib");

    if (!isWechatSdk(mod)) {
      wechatLogger.warn(
        "sdk.invalid-module",
        { platform: Platform.OS },
        "Wechat module did not expose the expected SDK surface",
      );
      return null;
    }

    WechatLib = mod;
    return WechatLib;
  } catch (error) {
    wechatLogger.error(
      "sdk.load.failed",
      { error, platform: Platform.OS },
      "Failed to load Wechat SDK",
    );
    return null;
  }
}

export async function initWechat(appId: string): Promise<boolean> {
  const normalizedAppId = appId.trim();

  if (!normalizedAppId) {
    return false;
  }

  if (registeredAppId === normalizedAppId) {
    return true;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const lib = getWechatLib();

      if (!lib) {
        return false;
      }

      const result = await lib.registerApp(normalizedAppId, "");

      if (result !== true) {
        wechatLogger.error(
          "register.failed.false-result",
          { appId: normalizedAppId },
          "Wechat registerApp returned false",
        );
        return false;
      }

      registeredAppId = normalizedAppId;
      wechatLogger.info(
        "register.succeeded",
        { appId: normalizedAppId },
        "Wechat SDK registered",
      );
      return true;
    } catch (error) {
      wechatLogger.error(
        "register.failed",
        { appId: normalizedAppId, error },
        "Failed to initialize Wechat SDK",
      );
      return false;
    }
  })();

  try {
    return await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

export async function isWechatInstalled(): Promise<boolean> {
  try {
    const lib = getWechatLib();
    if (!lib) {
      wechatLogger.warn(
        "installed-check.skipped.no-sdk",
        undefined,
        "Skipped Wechat installed check because SDK is unavailable",
      );
      return false;
    }
    const result = await lib.isWXAppInstalled();
    wechatLogger.info(
      "installed-check.finished",
      { installed: result },
      "Finished Wechat installed check",
    );
    return result;
  } catch (error) {
    wechatLogger.error(
      "installed-check.failed",
      { error },
      "Wechat installed check failed",
    );
    return false;
  }
}

export async function getWechatAuthCode(): Promise<string> {
  const appId = process.env.EXPO_PUBLIC_WECHAT_APP_ID?.trim();

  if (!appId) {
    throw new Error("微信登录配置不完整，请检查微信 AppID");
  }

  const initialized = await initWechat(appId);

  if (!initialized) {
    throw new Error("微信 SDK 初始化失败，请重新打开应用后再试");
  }

  const lib = getWechatLib();

  if (!lib) {
    wechatLogger.error(
      "auth-code.failed.no-sdk",
      undefined,
      "Wechat SDK is unavailable while requesting auth code",
    );
    throw new Error("微信 SDK 不可用");
  }

  wechatLogger.info(
    "auth-code.installed-check.started",
    undefined,
    "Started Wechat installed check before auth",
  );
  const installed = await isWechatInstalled();
  wechatLogger.info(
    "auth-code.installed-check.finished",
    { installed },
    "Finished Wechat installed check before auth",
  );

  if (!installed) {
    wechatLogger.warn(
      "auth-code.failed.not-installed",
      undefined,
      "Wechat is not installed",
    );
    throw new Error("请先安装微信");
  }

  try {
    const state = `wechat_${Date.now()}`;
    wechatLogger.info(
      "auth-code.request.started",
      undefined,
      "Started Wechat auth request",
    );
    const response = await lib.sendAuthRequest("snsapi_userinfo", state);
    wechatLogger.info(
      "auth-code.response.received",
      {
        errCode: response.errCode,
        hasCode: Boolean(response.code),
        stateMatches: response.state === state,
      },
      "Received Wechat auth response",
    );

    if (response.errCode !== 0) {
      wechatLogger.error(
        "auth-code.failed.response-error",
        {
          errCode: response.errCode,
          errStr: response.errStr,
        },
        "Wechat auth response returned an error code",
      );
      if (response.errCode === -2) {
        throw new Error("用户取消授权");
      }
      throw new Error(
        response.errStr || `微信授权失败 (错误码: ${response.errCode})`,
      );
    }

    if (!response.code) {
      throw new Error("微信授权未返回 code");
    }

    if (response.state !== state) {
      throw new Error("微信授权状态校验失败");
    }

    wechatLogger.info(
      "auth-code.succeeded",
      undefined,
      "Received Wechat auth code",
    );
    return response.code;
  } catch (error) {
    wechatLogger.error(
      "auth-code.failed",
      { error },
      "Failed to get Wechat auth code",
    );
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? Number((error as { code?: unknown }).code)
        : undefined;

    if (errorCode === -2) {
      throw new Error("已取消微信授权");
    }

    if (errorCode === -4) {
      throw new Error("微信拒绝了授权请求");
    }

    if (error instanceof Error) throw error;
    throw new Error("微信授权失败");
  }
}

export async function handleWechatCallback(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  try {
    const lib = getWechatLib();
    if (!lib) return false;
    return await lib.handleWechatCallback();
  } catch {
    return false;
  }
}

export async function getWechatSdkVersion(): Promise<string> {
  try {
    const lib = getWechatLib();
    if (!lib) return "unknown";
    return await lib.getApiVersion();
  } catch {
    return "unknown";
  }
}
