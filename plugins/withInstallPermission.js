//
//
//
//   "plugins": ["./plugins/withInstallPermission"]
//
//   https://docs.expo.dev/config-plugins/introduction/
//   https://developer.android.com/reference/android/Manifest.permission#REQUEST_INSTALL_PACKAGES
const { withAndroidManifest } = require("expo/config-plugins");

const INSTALL_PERMISSION = "android.permission.REQUEST_INSTALL_PACKAGES";

module.exports = function withInstallPermission(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;

    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    const alreadyHasPermission = manifest["uses-permission"].some(
      (perm) => perm.$?.["android:name"] === INSTALL_PERMISSION,
    );

    if (!alreadyHasPermission) {
      manifest["uses-permission"].push({
        $: {
          "android:name": INSTALL_PERMISSION,
        },
      });
    }

    return nextConfig;
  });
};
