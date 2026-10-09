import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
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
  const webViewRef = useRef<WebView | null>(null);
  const fitOptionsRef = useRef({ fitPadding, maxFitZoom });
  const theme = useAppTheme();
  const isConfigured = isAmapJsApiConfigured();
  const mapVisualPreset = useMemo(
    () => getAmapMapVisualPreset(visualPreset),
    [visualPreset],
  );
  const payload = useMemo(
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
      const nextPayload: AmapJsMapPayload = payload;
      const currentFitOptions = fitOptionsRef.current;
      webViewRef.current?.injectJavaScript(
        `window.__waylogUpdatePayload && window.__waylogUpdatePayload(${JSON.stringify(nextPayload)}, ${JSON.stringify(
          {
            delayMs: options?.delayMs ?? 40,
            durationMs: options?.durationMs ?? 460,
            fitPadding: currentFitOptions.fitPadding,
            maxFitZoom: currentFitOptions.maxFitZoom,
          },
        )}); true;`,
      );
    },
    [payload],
  );
  const sendActiveMarkerId = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      `window.__setAmapActiveMarkerId && window.__setAmapActiveMarkerId(${JSON.stringify(activeMarkerId ?? "")}); true;`,
    );
  }, [activeMarkerId]);
  const sendFitView = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      `window.__waylogFitView && window.__waylogFitView(${JSON.stringify({
        delayMs: 80,
        durationMs: 460,
        fitPadding,
        maxFitZoom,
      })}); true;`,
    );
  }, [fitPadding, maxFitZoom]);
  fitOptionsRef.current = { fitPadding, maxFitZoom };

  useEffect(() => {
    sendPayloadUpdate();
  }, [sendPayloadUpdate]);

  useEffect(() => {
    sendActiveMarkerId();
  }, [sendActiveMarkerId]);

  useEffect(() => {
    sendFitView();
  }, [sendFitView]);

  const handleLoadEnd = useCallback(() => {
    sendPayloadUpdate({ delayMs: 80 });
    sendActiveMarkerId();
    sendFitView();
  }, [sendActiveMarkerId, sendFitView, sendPayloadUpdate]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseAmapMapMessage(event.nativeEvent.data);

      if (
        message?.type === "markerPress" &&
        message.mapId === mapIdRef.current &&
        message.markerId
      ) {
        onMarkerPress?.(message.markerId);
      }
    },
    [onMarkerPress],
  );

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
      <WebView
        allowsInlineMediaPlayback
        bounces={false}
        javaScriptEnabled
        nestedScrollEnabled
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        originWhitelist={["*"]}
        overScrollMode="never"
        ref={webViewRef}
        scrollEnabled={false}
        source={{ html: documentHtml }}
        style={[
          styles.webview,
          { backgroundColor: mapVisualPreset.backgroundColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  webview: {
    flex: 1,
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
