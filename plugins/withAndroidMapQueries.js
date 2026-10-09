//
//
//
//   "plugins": ["./plugins/withAndroidMapQueries"]
//
//   https://docs.expo.dev/config-plugins/introduction/
//   https://developer.android.com/training/package-visibility
const { withAndroidManifest } = require("expo/config-plugins");

const MAP_QUERY_SCHEMES = ["androidamap", "baidumap", "geo"];

const VIEW_ACTION = "android.intent.action.VIEW";

function hasSchemeQuery(queries, scheme) {
  return queries.some((query) =>
    query.intent?.some(
      (intent) =>
        intent.action?.some(
          (action) => action.$?.["android:name"] === VIEW_ACTION,
        ) && intent.data?.some((data) => data.$?.["android:scheme"] === scheme),
    ),
  );
}

function createSchemeQuery(scheme) {
  return {
    intent: [
      {
        action: [
          {
            $: {
              "android:name": VIEW_ACTION,
            },
          },
        ],
        data: [
          {
            $: {
              "android:scheme": scheme,
            },
          },
        ],
      },
    ],
  };
}

module.exports = function withAndroidMapQueries(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    const queries = manifest.queries ?? [];

    MAP_QUERY_SCHEMES.forEach((scheme) => {
      if (!hasSchemeQuery(queries, scheme)) {
        queries.push(createSchemeQuery(scheme));
      }
    });

    manifest.queries = queries;
    return nextConfig;
  });
};
