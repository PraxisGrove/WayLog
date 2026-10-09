const { withGradleProperties } = require("expo/config-plugins");

const RELEASE_ANDROID_ABIS = "armeabi-v7a,arm64-v8a";
const RELEASE_ANDROID_ABI_PROPERTY = "reactNativeArchitectures";

function setGradleProperty(props, key, value) {
  const existing = props.find(
    (item) => item.type === "property" && item.key === key,
  );

  if (existing) {
    existing.value = value;
    return props;
  }

  props.push({
    type: "property",
    key,
    value,
  });

  return props;
}

module.exports = function withAndroidReleaseAbis(config) {
  return withGradleProperties(config, (nextConfig) => {
    nextConfig.modResults = setGradleProperty(
      nextConfig.modResults,
      RELEASE_ANDROID_ABI_PROPERTY,
      RELEASE_ANDROID_ABIS,
    );
    return nextConfig;
  });
};

module.exports.RELEASE_ANDROID_ABIS = RELEASE_ANDROID_ABIS;
module.exports.RELEASE_ANDROID_ABI_PROPERTY = RELEASE_ANDROID_ABI_PROPERTY;
module.exports.setGradleProperty = setGradleProperty;
