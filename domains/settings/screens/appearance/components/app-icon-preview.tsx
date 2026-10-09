import {
  Image,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";

import type { AppIconPatternId } from "@/features/appearance/app-icon";

const mascotSource = require("../../../../../assets/images/waylog-label/android-icon-foreground-waylog-label.png");

type AppIconPreviewProps = {
  mainColor: string;
  patternId: AppIconPatternId;
  softColor: string;
  style?: StyleProp<ViewStyle>;
};

function mixHexColors(color: string, target: string, targetWeight: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(target)) {
    return color;
  }

  const weight = Math.max(0, Math.min(1, targetWeight));
  const sourceRgb = [1, 3, 5].map((index) =>
    Number.parseInt(color.slice(index, index + 2), 16),
  );
  const targetRgb = [1, 3, 5].map((index) =>
    Number.parseInt(target.slice(index, index + 2), 16),
  );
  const mixed = sourceRgb.map((channel, index) =>
    Math.round(channel * (1 - weight) + targetRgb[index] * weight),
  );

  return `#${mixed
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function SunburstPattern({
  mainColor,
  softColor,
}: {
  mainColor: string;
  softColor: string;
}) {
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

  return (
    <>
      <Rect fill={softColor} height="108" width="108" />
      {rays.map((ray) => (
        <Path d={ray} fill={mainColor} key={ray} />
      ))}
    </>
  );
}

function HanddrawnCheckPattern({
  mainColor,
  softColor,
}: {
  mainColor: string;
  softColor: string;
}) {
  const cells = [
    "M0,0 H21.6 V21.6 H0 Z",
    "M43.2,0 H64.8 V21.6 H43.2 Z",
    "M86.4,0 H108 V21.6 H86.4 Z",
    "M21.6,21.6 H43.2 V43.2 H21.6 Z",
    "M64.8,21.6 H86.4 V43.2 H64.8 Z",
    "M0,43.2 H21.6 V64.8 H0 Z",
    "M43.2,43.2 H64.8 V64.8 H43.2 Z",
    "M86.4,43.2 H108 V64.8 H86.4 Z",
    "M21.6,64.8 H43.2 V86.4 H21.6 Z",
    "M64.8,64.8 H86.4 V86.4 H64.8 Z",
    "M0,86.4 H21.6 V108 H0 Z",
    "M43.2,86.4 H64.8 V108 H43.2 Z",
    "M86.4,86.4 H108 V108 H86.4 Z",
  ];

  return (
    <>
      <Rect fill={softColor} height="108" width="108" />
      {cells.map((cell) => (
        <Path d={cell} fill={mainColor} key={cell} />
      ))}
    </>
  );
}

function SoftWavesPattern({
  mainColor,
  softColor,
}: {
  mainColor: string;
  softColor: string;
}) {
  const paleLine = mixHexColors(mainColor, softColor, 0.72);
  const darkLine = mixHexColors(mainColor, "#124C54", 0.18);
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

  return (
    <>
      <Rect fill={mainColor} height="108" width="108" />
      {wavePaths.map((wave) => (
        <Path
          d={wave}
          fill="none"
          key={`pale-${wave}`}
          stroke={paleLine}
          strokeLinecap="round"
          strokeWidth={0.9}
        />
      ))}
      <G transform="translate(0 2.8)">
        {wavePaths.map((wave) => (
          <Path
            d={wave}
            fill="none"
            key={`dark-${wave}`}
            opacity={0.75}
            stroke={darkLine}
            strokeLinecap="round"
            strokeWidth={0.36}
          />
        ))}
      </G>
    </>
  );
}

function DiagonalBandsPattern({
  mainColor,
  softColor,
}: {
  mainColor: string;
  softColor: string;
}) {
  const stripe = mixHexColors(mainColor, softColor, 0.1);
  const highlight = mixHexColors(mainColor, softColor, 0.46);
  const bands = [-118, -81, -44, -7, 30, 67, 104, 141];

  return (
    <>
      <Rect fill={softColor} height="108" width="108" />
      {bands.map((offset) => (
        <G key={offset}>
          <Path
            d={`M${offset},108 L${offset + 22},108 L${offset + 130},0 L${offset + 108},0 Z`}
            fill={stripe}
          />
          <Path
            d={`M${offset + 22},108 L${offset + 130},0`}
            fill="none"
            stroke={highlight}
            strokeLinecap="round"
            strokeWidth={1.8}
          />
        </G>
      ))}
    </>
  );
}

function WideGridPattern({
  mainColor,
  softColor,
}: {
  mainColor: string;
  softColor: string;
}) {
  const block = mixHexColors(mainColor, softColor, 0.12);
  const quietBlock = mixHexColors(mainColor, softColor, 0.36);
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
        <Path
          d={`M${left},${top} H${right} V${bottom} H${left} Z`}
          fill={color}
          key={`${row}-${column}`}
        />,
      );
    }
  }

  return (
    <>
      <Rect fill={softColor} height="108" width="108" />
      {cells}
    </>
  );
}

function TiltedCheckPattern({
  mainColor,
  softColor,
}: {
  mainColor: string;
  softColor: string;
}) {
  const block = mixHexColors(mainColor, softColor, 0.1);
  const quietBlock = mixHexColors(mainColor, softColor, 0.32);
  const cells = [];

  for (let row = -2; row <= 6; row += 1) {
    for (let column = -2; column <= 6; column += 1) {
      if ((row + column) % 2 !== 0) {
        continue;
      }

      const x = column * 20;
      const y = row * 20;
      const color = row % 2 === 0 ? block : quietBlock;

      cells.push(
        <Path
          d={`M${x},${y} H${x + 20} V${y + 20} H${x} Z`}
          fill={color}
          key={`${row}-${column}`}
        />,
      );
    }
  }

  return (
    <>
      <Rect fill={softColor} height="108" width="108" />
      <G transform="rotate(45 54 54)">{cells}</G>
    </>
  );
}

function PatternArtwork({
  mainColor,
  patternId,
  softColor,
}: {
  mainColor: string;
  patternId: AppIconPatternId;
  softColor: string;
}) {
  switch (patternId) {
    case "sunburst":
      return <SunburstPattern mainColor={mainColor} softColor={softColor} />;
    case "handdrawn-check":
      return (
        <HanddrawnCheckPattern mainColor={mainColor} softColor={softColor} />
      );
    case "soft-waves":
      return <SoftWavesPattern mainColor={mainColor} softColor={softColor} />;
    case "diagonal-bands":
      return (
        <DiagonalBandsPattern mainColor={mainColor} softColor={softColor} />
      );
    case "wide-grid":
      return <WideGridPattern mainColor={mainColor} softColor={softColor} />;
    case "tilted-check":
      return <TiltedCheckPattern mainColor={mainColor} softColor={softColor} />;
  }
}

export function AppIconPreview({
  mainColor,
  patternId,
  softColor,
  style,
}: AppIconPreviewProps) {
  return (
    <View style={[styles.container, style]}>
      <Svg
        height="100%"
        style={StyleSheet.absoluteFillObject}
        viewBox="0 0 108 108"
        width="100%"
      >
        <PatternArtwork
          mainColor={mainColor}
          patternId={patternId}
          softColor={softColor}
        />
      </Svg>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={mascotSource}
        style={styles.mascot}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
  mascot: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
    position: "absolute",
    width: "100%",
  },
});
