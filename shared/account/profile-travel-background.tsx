import { LinearGradient } from "expo-linear-gradient";
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import {
  formatProfileFieldNoteDate,
  type getProfileTravelPaperBackground,
} from "@/shared/account/profile-visuals";

type ProfileTravelBackgroundTone = ReturnType<
  typeof getProfileTravelPaperBackground
>;

type ProfileTravelBackgroundProps = {
  tone: ProfileTravelBackgroundTone;
};

type RouteMarker = ProfileTravelBackgroundTone["routeMarkers"][number];
const horizontalRuleKeys = [
  "rule-1",
  "rule-2",
  "rule-3",
  "rule-4",
  "rule-5",
  "rule-6",
  "rule-7",
  "rule-8",
] as const;

function colorWithAlpha(color: string, alpha: number) {
  const normalized = color.trim();

  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    const alphaHex = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
      .toString(16)
      .padStart(2, "0");
    return `${normalized}${alphaHex}`;
  }

  return normalized;
}

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

function RadialGlow({
  color,
  id,
  intensity,
  size,
  style,
}: {
  color: string;
  id: string;
  intensity: number;
  size: number;
  style: ViewStyle;
}) {
  return (
    <View style={[styles.glow, { height: size, width: size }, style]}>
      <Svg height="100%" viewBox="0 0 100 100" width="100%">
        <Defs>
          <RadialGradient
            cx="50%"
            cy="50%"
            fx="50%"
            fy="50%"
            id={id}
            rx="50%"
            ry="50%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={intensity} />
            <Stop
              offset="58%"
              stopColor={color}
              stopOpacity={intensity * 0.44}
            />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect fill={`url(#${id})`} height="100" width="100" />
      </Svg>
    </View>
  );
}

function TravelRouteMarker({
  color,
  marker,
  opacity,
  paperColor,
}: {
  color: string;
  marker: RouteMarker;
  opacity: number;
  paperColor: string;
}) {
  const transform = `rotate(${marker.rotation}) scale(${marker.scale})`;

  if (marker.kind === "saturn-beacon") {
    return (
      <G opacity={opacity} transform={transform}>
        <Circle fill={color} fillOpacity={0.72} r={6.1} />
        <Ellipse
          cx={0}
          cy={0}
          fill="none"
          rx={12.8}
          ry={4.7}
          stroke={color}
          strokeWidth={1.15}
        />
        <Path
          d="M-10.2 1.5 C-4.2 5.2 4.8 5 10.3 1.2"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={1.15}
        />
        <Circle cx={10.8} cy={-8.4} fill={color} fillOpacity={0.72} r={1.3} />
        <Path
          d="M10.8 -11 V-5.8 M8.2 -8.4 H13.4"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={0.75}
        />
      </G>
    );
  }

  if (marker.kind === "landing-burn") {
    return (
      <G opacity={opacity} transform={transform}>
        <Path
          d="M-2.5 -11 Q0 -13 2.5 -11 L2.8 2.8 Q0 4.5 -2.8 2.8 Z"
          fill={paperColor}
          fillOpacity={0.82}
          stroke={color}
          strokeLinejoin="round"
          strokeWidth={1.15}
        />
        <Path
          d="M-2.3 2.5 L-7 8 M2.3 2.5 L7 8 M-8.5 8 H-5 M8.5 8 H5"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.15}
        />
        <Path
          d="M-2.2 4.3 Q0 12.5 2.2 4.3 Q0 7.2 -2.2 4.3 Z"
          fill={color}
          fillOpacity={0.72}
        />
        <Path
          d="M-12 10.5 C-6.5 9.3 6.5 9.3 12 10.5"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={1.15}
        />
        <Circle
          fill="none"
          opacity={0.55}
          r={14}
          stroke={color}
          strokeDasharray={[1, 4]}
          strokeWidth={1}
        />
      </G>
    );
  }

  return (
    <G opacity={opacity} transform={transform}>
      <Path
        d="M-2.8 -10.5 Q0 -13 2.8 -10.5 L3.2 4.7 Q0 6.5 -3.2 4.7 Z"
        fill={paperColor}
        fillOpacity={0.82}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={1.15}
      />
      <Path d="M-2.8 -7.2 H2.8 V-4.8 H-2.8 Z" fill={color} fillOpacity={0.72} />
      <Path
        d="M-3.1 -1.5 L-6 -3.7 M3.1 -1.5 L6 -3.7 M-2.5 4.5 L-6.8 9 M2.5 4.5 L6.8 9 M-6.8 9 H-4 M6.8 9 H4"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.15}
      />
      <Path d="M-1.7 6.2 L0 10.5 L1.7 6.2 Z" fill={color} fillOpacity={0.72} />
    </G>
  );
}

export function ProfileTravelBackground({
  tone,
}: ProfileTravelBackgroundProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const fieldNoteDate = formatProfileFieldNoteDate(new Date());
  const fieldNoteDateValue = fieldNoteDate.replace(
    `${tone.annotationPrefix}  `,
    "",
  );
  const fieldGlowSize = Math.min(Math.max(viewportWidth * 1.05, 420), 620);
  const fieldGlowColor = mixHexColors(tone.glowColor, tone.baseColor, 0.5);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.background]}
    >
      <RadialGlow
        color={fieldGlowColor}
        id="field-notes-primary-glow"
        intensity={tone.glowIntensity}
        size={fieldGlowSize}
        style={{
          left: viewportWidth * 0.78 - fieldGlowSize / 2,
          top: -fieldGlowSize / 2 + 8,
        }}
      />
      <LinearGradient
        colors={[
          colorWithAlpha(tone.paperSheenColor, tone.sheenOpacity),
          colorWithAlpha(tone.paperSheenColor, 0),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.42 }}
        style={StyleSheet.absoluteFill}
      />

      {horizontalRuleKeys
        .slice(0, tone.horizontalLineCount)
        .map((ruleKey, index) => (
          <View
            key={ruleKey}
            style={[
              styles.horizontalRule,
              {
                backgroundColor: tone.gridColor,
                opacity: tone.gridOpacity,
                top: tone.horizontalLineStart + index * tone.horizontalLineGap,
              },
            ]}
          />
        ))}

      <View
        style={[
          styles.marginRule,
          {
            backgroundColor: tone.routeColor,
            left: tone.marginLineOffset,
            opacity: tone.marginLineOpacity,
          },
        ]}
      />
      <Text
        style={[styles.fieldNotesAnnotation, { color: tone.annotationColor }]}
      >
        <Text style={styles.fieldNotesAnnotationLabel}>
          {tone.annotationPrefix}
        </Text>
        <Text style={styles.fieldNotesAnnotationDate}>
          {`  ${fieldNoteDateValue}`}
        </Text>
      </Text>

      <Svg
        height={844}
        preserveAspectRatio="none"
        style={styles.routeMap}
        viewBox="0 0 390 844"
        width="100%"
      >
        {tone.routePaths.map((path) => (
          <Path
            d={path}
            fill="none"
            key={path}
            opacity={0.32}
            stroke={tone.routeColor}
            strokeDasharray={[2, 9]}
            strokeLinecap="round"
            strokeWidth={1.2}
          />
        ))}
      </Svg>
      <View style={styles.routeMarkerLayer}>
        {tone.routeMarkers.map((marker) => (
          <View
            key={`${marker.kind}-${marker.cx}-${marker.cy}`}
            style={[
              styles.routeMarker,
              {
                left: (marker.cx / 390) * viewportWidth - 20,
                top: marker.cy - 20,
              },
            ]}
          >
            <Svg height={40} viewBox="-20 -20 40 40" width={40}>
              <TravelRouteMarker
                color={tone.routeColor}
                marker={marker}
                opacity={tone.pinOpacity * 0.86}
                paperColor={tone.baseColor}
              />
            </Svg>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    overflow: "hidden",
  },
  fieldNotesAnnotation: {
    fontFamily: "Georgia",
    left: -64,
    opacity: 0.72,
    position: "absolute",
    textAlign: "center",
    top: 90,
    transform: [{ rotate: "90deg" }],
    width: 176,
  },
  fieldNotesAnnotationDate: {
    fontFamily: "Georgia",
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 1.55,
    lineHeight: 15,
  },
  fieldNotesAnnotationLabel: {
    fontFamily: "Georgia",
    fontSize: 10.5,
    fontWeight: "500",
    letterSpacing: 1.55,
    lineHeight: 15,
  },
  glow: {
    borderRadius: 999,
    overflow: "hidden",
    position: "absolute",
  },
  horizontalRule: {
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: "absolute",
    right: 0,
  },
  marginRule: {
    bottom: 0,
    position: "absolute",
    top: 0,
    width: StyleSheet.hairlineWidth,
  },
  routeMap: {
    left: 0,
    position: "absolute",
    top: 0,
  },
  routeMarker: {
    height: 40,
    position: "absolute",
    width: 40,
  },
  routeMarkerLayer: {
    height: 844,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
