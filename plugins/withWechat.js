const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const {
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
} = require("expo/config-plugins");

function writeLine(...messages) {
  process.stdout.write(`${messages.join(" ")}\n`);
}

function writeErrorLine(...messages) {
  process.stderr.write(`${messages.join(" ")}\n`);
}

const withWechatIOS = (config, appId) => {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    if (!infoPlist.CFBundleURLTypes) {
      infoPlist.CFBundleURLTypes = [];
    }

    const wechatScheme = infoPlist.CFBundleURLTypes.find((type) =>
      type.CFBundleURLSchemes?.includes(appId),
    );

    if (!wechatScheme) {
      infoPlist.CFBundleURLTypes.push({
        CFBundleURLName: "wechat",
        CFBundleURLSchemes: [appId],
      });
    }

    if (!infoPlist.LSApplicationQueriesSchemes) {
      infoPlist.LSApplicationQueriesSchemes = [];
    }

    if (!infoPlist.LSApplicationQueriesSchemes.includes("weixin")) {
      infoPlist.LSApplicationQueriesSchemes.push("weixin");
    }

    if (!infoPlist.LSApplicationQueriesSchemes.includes("weixinULAPI")) {
      infoPlist.LSApplicationQueriesSchemes.push("weixinULAPI");
    }

    return config;
  });
};

const withWechatAndroidManifest = (config, appId) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainApplication = manifest.manifest.application?.[0];
    const androidPackage = config.android?.package;

    if (!mainApplication || !androidPackage) {
      return config;
    }

    if (!manifest.manifest.queries) {
      manifest.manifest.queries = [];
    }

    const wechatQueryExists = manifest.manifest.queries.some(
      (q) => q.intent?.[0]?.data?.[0]?.$?.["android:scheme"] === "weixin",
    );

    if (!wechatQueryExists) {
      manifest.manifest.queries.push({
        intent: [
          {
            action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
            category: [
              { $: { "android:name": "android.intent.category.DEFAULT" } },
            ],
            data: [{ $: { "android:scheme": "weixin" } }],
          },
        ],
      });
    }

    let wxEntryActivity = mainApplication.activity?.find(
      (activity) => activity.$["android:name"] === ".wxapi.WXEntryActivity",
    );

    if (!wxEntryActivity) {
      if (!mainApplication.activity) {
        mainApplication.activity = [];
      }

      wxEntryActivity = {
        $: {
          "android:name": ".wxapi.WXEntryActivity",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
            category: [
              { $: { "android:name": "android.intent.category.DEFAULT" } },
            ],
            data: [{ $: { "android:scheme": appId } }],
          },
        ],
      };
      mainApplication.activity.push(wxEntryActivity);
    }

    wxEntryActivity.$["android:exported"] = "true";
    wxEntryActivity.$["android:launchMode"] = "singleTask";
    wxEntryActivity.$["android:taskAffinity"] = androidPackage;
    wxEntryActivity.$["android:theme"] =
      "@android:style/Theme.Translucent.NoTitleBar";

    return config;
  });
};

const withWechatAndroidEntryActivity = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidPackage = config.android?.package;

      if (!androidPackage) {
        throw new Error("[withWechat] expo.android.package is required.");
      }

      const javaDirectory = join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...androidPackage.split("."),
        "wxapi",
      );
      const activityPath = join(javaDirectory, "WXEntryActivity.java");
      const activitySource = `package ${androidPackage}.wxapi;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

import com.theweflex.react.WeChatModule;

public class WXEntryActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WeChatModule.handleIntent(getIntent());
        finish();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        WeChatModule.handleIntent(intent);
        finish();
    }
}
`;

      mkdirSync(javaDirectory, { recursive: true });
      writeFileSync(activityPath, activitySource, "utf8");

      return config;
    },
  ]);
};

module.exports = function withWechat(config) {
  const appId =
    process.env.EXPO_PUBLIC_WECHAT_APP_ID || config.extra?.wechat?.appId;

  if (!appId) {
    writeErrorLine(
      "[withWechat] WeChat AppID not found. Set EXPO_PUBLIC_WECHAT_APP_ID or extra.wechat.appId in app.json",
    );
    return config;
  }

  writeLine("[withWechat] Configuring with AppID:", appId);

  config = withWechatIOS(config, appId);
  config = withWechatAndroidManifest(config, appId);
  config = withWechatAndroidEntryActivity(config);

  return config;
};
