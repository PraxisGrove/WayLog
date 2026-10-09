const { withAppBuildGradle } = require("expo/config-plugins");

const releaseSigningConfig = `
        release {
            def releaseStoreFile = findProperty('RELEASE_STORE_FILE')
            if (releaseStoreFile) {
                storeFile file(releaseStoreFile)
                storePassword findProperty('RELEASE_STORE_PASSWORD')
                keyAlias findProperty('RELEASE_KEY_ALIAS')
                keyPassword findProperty('RELEASE_KEY_PASSWORD')
            }
        }`;

function configureAndroidReleaseSigning(buildGradle) {
  let contents = buildGradle;
  const signingConfigsStart = contents.indexOf("signingConfigs {");
  const buildTypesStart = contents.indexOf("buildTypes {", signingConfigsStart);
  const signingConfigsSection =
    signingConfigsStart >= 0 && buildTypesStart > signingConfigsStart
      ? contents.slice(signingConfigsStart, buildTypesStart)
      : "";

  if (!/\brelease\s*\{/.test(signingConfigsSection)) {
    const debugSigningBlock =
      /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?keyPassword\s+['"]android['"]\s*\})/;

    if (!debugSigningBlock.test(contents)) {
      throw new Error(
        "[withAndroidReleaseSigning] Unable to locate Android debug signing config.",
      );
    }

    contents = contents.replace(debugSigningBlock, `$1${releaseSigningConfig}`);
  }

  if (
    !/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.(debug|release)/.test(
      contents,
    )
  ) {
    throw new Error(
      "[withAndroidReleaseSigning] Unable to locate Android release build type.",
    );
  }

  return contents.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.(debug|release)/,
    "$1signingConfig signingConfigs.release",
  );
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = configureAndroidReleaseSigning(
      config.modResults.contents,
    );
    return config;
  });
};

module.exports.configureAndroidReleaseSigning = configureAndroidReleaseSigning;
