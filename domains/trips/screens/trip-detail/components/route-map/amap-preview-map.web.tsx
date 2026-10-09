import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  type AmapJsMapPayload,
  type AmapPreviewMapProps,
  buildAmapJsMapHtml,
  getAmapMapVisualPreset,
  isAmapJsApiConfigured,
  parseAmapMapMessage,
} from "@/features/trips";
import { getAmapSecurityCode } from "@/features/trips/amap-security-code-cache";
import { useAppTheme } from "@/shared/theme/use-app-theme";

function createMapId(): string {
  return `amap-map-${Math.random().toString(36).slice(2)}`;
}

export function AmapPreviewMap({
  activeMarkerId,
  center,
  fitCoordinates,
  fitViewControl,
  fitPadding,
  markers = [],
  maxFitZoom,
  onMarkerPress,
  placeholderDescription = "请先在 .env.local 里配置高德 JS API Key 和安全密钥",
  placeholderTitle = "高德 JS API 待配置",
  polylines = [],
  polygons = [],
  showScale,
  showToolbar,
  style,
  toolbarPosition,
  visualPreset,
  zoom,
}: AmapPreviewMapProps) {
  const mapIdRef = useRef(createMapId());
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fitOptionsRef = useRef({ fitPadding, maxFitZoom });
  const theme = useAppTheme();
  const isConfigured = isAmapJsApiConfigured();
  const mapVisualPreset = useMemo(
    () => getAmapMapVisualPreset(visualPreset),
    [visualPreset],
  );
  const [securityCodeState, setSecurityCodeState] = useState<{
    securityCode?: string;
    backupSecurityCode?: string;
    loading: boolean;
    error: boolean;
  }>({ loading: true, error: false });

  useEffect(() => {
    let cancelled = false;

    getAmapSecurityCode()
      .then((result) => {
        if (!cancelled) {
          setSecurityCodeState({
            securityCode: result?.securityCode,
            backupSecurityCode: result?.backupSecurityCode,
            loading: false,
            error: !result,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSecurityCodeState({ loading: false, error: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const payload = useMemo<AmapJsMapPayload>(
    () => ({
      center,
      fitCoordinates,
      fitViewControl,
      mapId: mapIdRef.current,
      markers,
      maxFitZoom,
      polylines,
      polygons,
      showScale,
      showToolbar,
      toolbarPosition,
      visualPreset: mapVisualPreset.name,
      zoom,
    }),
    [
      center,
      fitCoordinates,
      fitViewControl,
      mapVisualPreset.name,
      markers,
      maxFitZoom,
      polylines,
      polygons,
      showScale,
      showToolbar,
      toolbarPosition,
      zoom,
    ],
  );

  const documentHtml = useMemo(
    () =>
      buildAmapJsMapHtml(
        {
          fitCoordinates: [],
          mapId: mapIdRef.current,
          markers: [],
          polylines: [],
          polygons: [],
          visualPreset: mapVisualPreset.name,
        },
        {
          securityCode: securityCodeState.securityCode,
          backupSecurityCode: securityCodeState.backupSecurityCode,
        },
      ),
    [
      mapVisualPreset.name,
      securityCodeState.securityCode,
      securityCodeState.backupSecurityCode,
    ],
  );
  const sendPayloadUpdate = useCallback(
    (options?: { delayMs?: number; durationMs?: number }) => {
      const currentFitOptions = fitOptionsRef.current;
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          mapId: mapIdRef.current,
          options: {
            delayMs: options?.delayMs ?? 40,
            durationMs: options?.durationMs ?? 460,
            fitPadding: currentFitOptions.fitPadding,
            maxFitZoom: currentFitOptions.maxFitZoom,
          },
          payload,
          type: "updatePayload",
        }),
        "*",
      );
    },
    [payload],
  );
  const sendFitView = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        delayMs: 80,
        durationMs: 460,
        fitPadding,
        mapId: mapIdRef.current,
        maxFitZoom,
        type: "fitView",
      }),
      "*",
    );
  }, [fitPadding, maxFitZoom]);
  fitOptionsRef.current = { fitPadding, maxFitZoom };

  const sendActiveMarkerId = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        activeMarkerId,
        mapId: mapIdRef.current,
        type: "activeMarker",
      }),
      "*",
    );
  }, [activeMarkerId]);

  useEffect(() => {
    sendPayloadUpdate();
  }, [sendPayloadUpdate]);

  useEffect(() => {
    sendActiveMarkerId();
  }, [sendActiveMarkerId]);

  useEffect(() => {
    sendFitView();
  }, [sendFitView]);

  const handleFrameLoad = useCallback(() => {
    sendPayloadUpdate({ delayMs: 80 });
    sendActiveMarkerId();
    sendFitView();
  }, [sendActiveMarkerId, sendFitView, sendPayloadUpdate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleMessage = (event: MessageEvent) => {
      const message = parseAmapMapMessage(event.data);

      if (
        message?.type === "markerPress" &&
        message.mapId === mapIdRef.current &&
        message.markerId
      ) {
        onMarkerPress?.(message.markerId);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, [onMarkerPress]);

  if (!isConfigured) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: mapVisualPreset.backgroundColor },
          styles.placeholder,
          style,
        ]}
      >
        <Text
          style={[styles.placeholderTitle, { color: theme.colors.textMuted }]}
        >
          {placeholderTitle}
        </Text>
        <Text
          style={[
            styles.placeholderDescription,
            { color: theme.colors.textSubtle },
          ]}
        >
          {placeholderDescription}
        </Text>
      </View>
    );
  }

  if (securityCodeState.loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: mapVisualPreset.backgroundColor },
          styles.placeholder,
          style,
        ]}
      >
        <Text
          style={[
            styles.placeholderDescription,
            { color: theme.colors.textSubtle },
          ]}
        >
          加载地图中...
        </Text>
      </View>
    );
  }

  if (securityCodeState.error || !securityCodeState.securityCode) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: mapVisualPreset.backgroundColor },
          styles.placeholder,
          style,
        ]}
      >
        <Text
          style={[styles.placeholderTitle, { color: theme.colors.textMuted }]}
        >
          地图加载失败
        </Text>
        <Text
          style={[
            styles.placeholderDescription,
            { color: theme.colors.textSubtle },
          ]}
        >
          请检查网络连接后重试
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: mapVisualPreset.backgroundColor },
        style,
      ]}
    >
      {React.createElement("iframe", {
        allow: "geolocation",
        onLoad: handleFrameLoad,
        ref: iframeRef,
        referrerPolicy: "no-referrer-when-downgrade",
        srcDoc: documentHtml,
        style: iframeStyle,
        title: "高德地图",
      })}
    </View>
  );
}

const iframeStyle = {
  border: "0",
  height: "100%",
  width: "100%",
} as const;

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 16,
  },
  placeholderTitle: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  placeholderDescription: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
});
