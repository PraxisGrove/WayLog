const fs = require("node:fs");
const path = require("node:path");

const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");

const THEMES = {
  warm: {
    main: "#F2CD68",
    soft: "#FFF0B8",
  },
  nature: {
    main: "#9DD6B5",
    soft: "#D3F0D7",
  },
  ocean: {
    main: "#68D6E8",
    soft: "#C8F2F4",
  },
  lavender: {
    main: "#B7A6DE",
    soft: "#DDD5F4",
  },
  cherry: {
    main: "#E99A9B",
    soft: "#FFD0C8",
  },
};

const PATTERNS = [
  "sunburst",
  "handdrawn-check",
  "soft-waves",
  "diagonal-bands",
  "wide-grid",
  "tilted-check",
];
const PRIMARY_ICON = "warm-sunburst";
const MAIN_ACTION = "android.intent.action.MAIN";
const LAUNCHER_CATEGORY = "android.intent.category.LAUNCHER";

const ICONS = Object.keys(THEMES).flatMap((theme) =>
  PATTERNS.map((pattern) => ({
    alias: `Icon${toPascalCase(theme)}${toPascalCase(pattern)}`,
    key: `${theme}-${pattern}`,
    pattern,
    resource: `waylog_icon_${theme}_${pattern.replace(/-/g, "_")}`,
    theme,
  })),
);

function toPascalCase(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function isLauncherIntentFilter(intentFilter) {
  const hasMainAction = intentFilter.action?.some(
    (action) => action.$?.["android:name"] === MAIN_ACTION,
  );
  const hasLauncherCategory = intentFilter.category?.some(
    (category) => category.$?.["android:name"] === LAUNCHER_CATEGORY,
  );
  return hasMainAction && hasLauncherCategory;
}

function createLauncherAlias(icon) {
  return {
    $: {
      "android:name": `.${icon.alias}`,
      "android:enabled": icon.key === PRIMARY_ICON ? "true" : "false",
      "android:exported": "true",
      "android:icon": `@mipmap/${icon.resource}`,
      "android:roundIcon": `@mipmap/${icon.resource}`,
      "android:label": "@string/app_name",
      "android:targetActivity": ".MainActivity",
    },
    "intent-filter": [
      {
        action: [{ $: { "android:name": MAIN_ACTION } }],
        category: [{ $: { "android:name": LAUNCHER_CATEGORY } }],
      },
    ],
  };
}

function withAndroidAliases(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      nextConfig.modResults,
    );
    const mainActivity = application.activity?.find(
      (activity) => activity.$?.["android:name"] === ".MainActivity",
    );

    if (!mainActivity) {
      throw new Error("Unable to find .MainActivity for alternate app icons.");
    }

    mainActivity["intent-filter"] = (
      mainActivity["intent-filter"] ?? []
    ).filter((intentFilter) => !isLauncherIntentFilter(intentFilter));
    application["activity-alias"] = ICONS.map(createLauncherAlias);
    return nextConfig;
  });
}

function mixHexColors(color, target, targetWeight) {
  const source = color.replace("#", "");
  const destination = target.replace("#", "");
  const weight = Math.max(0, Math.min(1, targetWeight));
  const sourceRgb = [0, 2, 4].map((index) =>
    Number.parseInt(source.slice(index, index + 2), 16),
  );
  const destinationRgb = [0, 2, 4].map((index) =>
    Number.parseInt(destination.slice(index, index + 2), 16),
  );
  const mixed = sourceRgb.map((channel, index) =>
    Math.round(channel * (1 - weight) + destinationRgb[index] * weight),
  );

  return `#${mixed
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function adaptiveIconXml(icon) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
    `  <background android:drawable="@drawable/${icon.resource}_background" />`,
    '  <foreground android:drawable="@mipmap/ic_launcher_foreground" />',
    '  <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />',
    "</adaptive-icon>",
    "",
  ].join("\n");
}

function fallbackIconXml(icon) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">',
    `  <item android:drawable="@drawable/${icon.resource}_background" />`,
    '  <item android:drawable="@mipmap/ic_launcher_foreground" />',
    "</layer-list>",
    "",
  ].join("\n");
}

function drawableRoot(children) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
    '  android:width="108dp"',
    '  android:height="108dp"',
    '  android:viewportWidth="108"',
    '  android:viewportHeight="108">',
    children,
    "</vector>",
    "",
  ].join("\n");
}

function vectorPath(fillColor, pathData, extra = "") {
  const attributes = [
    `android:fillColor="${fillColor}"`,
    `android:pathData="${pathData}"`,
  ];
  if (extra) {
    attributes.push(extra);
  }

  return `  <path ${attributes.join(" ")} />`;
}

function strokePath(strokeColor, strokeWidth, pathData, extra = "") {
  const attributes = [
    'android:fillColor="@android:color/transparent"',
    `android:strokeColor="${strokeColor}"`,
    `android:strokeWidth="${strokeWidth}"`,
    'android:strokeLineCap="round"',
    `android:pathData="${pathData}"`,
  ];
  if (extra) {
    attributes.push(extra);
  }

  return `  <path ${attributes.join(" ")} />`;
}

function group(children, extra = "") {
  const attrs = extra ? ` ${extra}` : "";
  return `  <group${attrs}>\n${children
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")}\n  </group>`;
}

function sunburstBackground(main, soft) {
  const rays = [
    "M54,54 L23.76,-98.02 A155,155 0 0,1 84.24,-98.02 Z",
    "M54,54 L140.11,-74.88 A155,155 0 0,1 182.88,-32.11 Z",
    "M54,54 L206.02,23.76 A155,155 0 0,1 206.02,84.24 Z",
    "M54,54 L182.88,140.11 A155,155 0 0,1 140.11,182.88 Z",
    "M54,54 L84.24,206.02 A155,155 0 0,1 23.76,206.02 Z",
    "M54,54 L-32.11,182.88 A155,155 0 0,1 -74.88,140.11 Z",
    "M54,54 L-98.02,84.24 A155,155 0 0,1 -98.02,23.76 Z",
    "M54,54 L-74.88,-32.11 A155,155 0 0,1 -32.11,-74.88 Z",
  ];

  return drawableRoot(
    [
      vectorPath(soft, "M0,0 H108 V108 H0 Z"),
      ...rays.map((ray) => vectorPath(main, ray)),
    ].join("\n"),
  );
}

function handdrawnCheckBackground(main, soft) {
  return drawableRoot(
    [
      vectorPath(soft, "M0,0 H108 V108 H0 Z"),
      vectorPath(main, "M0,0 H21.6 V21.6 H0 Z"),
      vectorPath(main, "M43.2,0 H64.8 V21.6 H43.2 Z"),
      vectorPath(main, "M86.4,0 H108 V21.6 H86.4 Z"),
      vectorPath(main, "M21.6,21.6 H43.2 V43.2 H21.6 Z"),
      vectorPath(main, "M64.8,21.6 H86.4 V43.2 H64.8 Z"),
      vectorPath(main, "M0,43.2 H21.6 V64.8 H0 Z"),
      vectorPath(main, "M43.2,43.2 H64.8 V64.8 H43.2 Z"),
      vectorPath(main, "M86.4,43.2 H108 V64.8 H86.4 Z"),
      vectorPath(main, "M21.6,64.8 H43.2 V86.4 H21.6 Z"),
      vectorPath(main, "M64.8,64.8 H86.4 V86.4 H64.8 Z"),
      vectorPath(main, "M0,86.4 H21.6 V108 H0 Z"),
      vectorPath(main, "M43.2,86.4 H64.8 V108 H43.2 Z"),
      vectorPath(main, "M86.4,86.4 H108 V108 H86.4 Z"),
    ].join("\n"),
  );
}

function softWavesBackground(main, soft) {
  const paleLine = mixHexColors(main, soft, 0.72);
  const darkLine = mixHexColors(main, "#124C54", 0.18);
  const wavePaths = [
    "M-2,-3 C8,-5 14,-1 24,-3 S40,-5 50,-3 S66,-1 76,-3 S94,-5 110,-2",
    "M-2,8 C8,6 14,10 24,8 S40,6 50,8 S66,10 76,8 S94,6 110,9",
    "M-2,19 C8,17 14,21 24,19 S40,17 50,19 S66,21 76,19 S94,17 110,20",
    "M-2,30 C8,28 14,32 24,30 S40,28 50,30 S66,32 76,30 S94,28 110,31",
    "M-2,41 C8,39 14,43 24,41 S40,39 50,41 S66,43 76,41 S94,39 110,42",
    "M-2,52 C8,50 14,54 24,52 S40,50 50,52 S66,54 76,52 S94,50 110,53",
    "M-2,63 C8,61 14,65 24,63 S40,61 50,63 S66,65 76,63 S94,61 110,64",
    "M-2,74 C8,72 14,76 24,74 S40,72 50,74 S66,76 76,74 S94,72 110,75",
    "M-2,85 C8,83 14,87 24,85 S40,83 50,85 S66,87 76,85 S94,83 110,86",
    "M-2,96 C8,94 14,98 24,96 S40,94 50,96 S66,98 76,96 S94,94 110,97",
  ];

  return drawableRoot(
    [
      vectorPath(main, "M0,0 H108 V108 H0 Z"),
      ...wavePaths.map((wave) => strokePath(paleLine, 0.9, wave)),
      group(
        wavePaths
          .map((wave) =>
            strokePath(darkLine, 0.36, wave, 'android:strokeAlpha="0.75"'),
          )
          .join("\n"),
        'android:translateY="2.8"',
      ),
    ].join("\n"),
  );
}

function diagonalBandsBackground(main, soft) {
  const stripe = mixHexColors(main, soft, 0.1);
  const highlight = mixHexColors(main, soft, 0.46);
  const bands = [-118, -81, -44, -7, 30, 67, 104, 141];

  return drawableRoot(
    [
      vectorPath(soft, "M0,0 H108 V108 H0 Z"),
      ...bands.flatMap((offset) => [
        vectorPath(
          stripe,
          `M${offset},108 L${offset + 22},108 L${offset + 130},0 L${offset + 108},0 Z`,
        ),
        strokePath(highlight, 1.8, `M${offset + 22},108 L${offset + 130},0`),
      ]),
    ].join("\n"),
  );
}

function wideGridBackground(main, soft) {
  const block = mixHexColors(main, soft, 0.12);
  const quietBlock = mixHexColors(main, soft, 0.36);
  const cells = [];

  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const inset = (row + column) % 2 === 0 ? 1 : 2;
      const left = column * 27 + inset;
      const top = row * 27 + inset;
      const right = (column + 1) * 27 - inset;
      const bottom = (row + 1) * 27 - inset;
      const color = (row + column) % 2 === 0 ? block : quietBlock;
      cells.push(
        vectorPath(color, `M${left},${top} H${right} V${bottom} H${left} Z`),
      );
    }
  }

  return drawableRoot(
    [vectorPath(soft, "M0,0 H108 V108 H0 Z"), ...cells].join("\n"),
  );
}

function tiltedCheckBackground(main, soft) {
  const block = mixHexColors(main, soft, 0.1);
  const quietBlock = mixHexColors(main, soft, 0.32);
  const cells = [];

  for (let row = -2; row <= 6; row += 1) {
    for (let column = -2; column <= 6; column += 1) {
      if ((row + column) % 2 !== 0) {
        continue;
      }
      const x = column * 20;
      const y = row * 20;
      const color = row % 2 === 0 ? block : quietBlock;
      cells.push(vectorPath(color, `M${x},${y} H${x + 20} V${y + 20} H${x} Z`));
    }
  }

  return drawableRoot(
    [
      vectorPath(soft, "M0,0 H108 V108 H0 Z"),
      group(
        cells.join("\n"),
        'android:rotation="45" android:pivotX="54" android:pivotY="54"',
      ),
    ].join("\n"),
  );
}

function backgroundXml(theme, pattern) {
  const colors = THEMES[theme];
  switch (pattern) {
    case "handdrawn-check":
      return handdrawnCheckBackground(colors.main, colors.soft);
    case "soft-waves":
      return softWavesBackground(colors.main, colors.soft);
    case "diagonal-bands":
      return diagonalBandsBackground(colors.main, colors.soft);
    case "wide-grid":
      return wideGridBackground(colors.main, colors.soft);
    case "tilted-check":
      return tiltedCheckBackground(colors.main, colors.soft);
    default:
      return sunburstBackground(colors.main, colors.soft);
  }
}

function withAndroidIconResources(config) {
  return withDangerousMod(config, [
    "android",
    async (nextConfig) => {
      const androidRoot = nextConfig.modRequest.platformProjectRoot;
      const appResRoot = path.join(androidRoot, "app", "src", "main", "res");
      const mipmapAnyDpiFallback = path.join(appResRoot, "mipmap-anydpi");
      const mipmapAnyDpi = path.join(appResRoot, "mipmap-anydpi-v26");
      const drawable = path.join(appResRoot, "drawable");

      await Promise.all([
        fs.promises.mkdir(mipmapAnyDpiFallback, { recursive: true }),
        fs.promises.mkdir(mipmapAnyDpi, { recursive: true }),
        fs.promises.mkdir(drawable, { recursive: true }),
      ]);

      await Promise.all(
        ICONS.flatMap((icon) => [
          fs.promises.writeFile(
            path.join(mipmapAnyDpi, `${icon.resource}.xml`),
            adaptiveIconXml(icon),
          ),
          fs.promises.writeFile(
            path.join(mipmapAnyDpiFallback, `${icon.resource}.xml`),
            fallbackIconXml(icon),
          ),
          fs.promises.writeFile(
            path.join(drawable, `${icon.resource}_background.xml`),
            backgroundXml(icon.theme, icon.pattern),
          ),
        ]),
      );

      return nextConfig;
    },
  ]);
}

module.exports = function withAlternateAppIcons(config) {
  config = withAndroidAliases(config);
  config = withAndroidIconResources(config);
  return config;
};
