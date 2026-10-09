const isPiNativeProbe = process.env.WAYLOG_PI_NATIVE_PROBE === "1";
const wechatPlatforms = {
  android: {
    packageImportPath: "import com.theweflex.react.WeChatPackage;",
    packageInstance: "new WeChatPackage()",
  },
};

if (isPiNativeProbe) {
  wechatPlatforms.ios = null;
}

module.exports = {
  dependencies: {
    "react-native-wechat-lib": {
      platforms: wechatPlatforms,
    },
  },
};
