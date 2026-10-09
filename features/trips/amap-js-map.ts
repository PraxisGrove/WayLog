import type { StyleProp, ViewStyle } from "react-native";

import {
  getCoordinateFromWorldPoint,
  getFittedViewport,
} from "./day-route-map-helpers";

export type AmapJsCoordinate = {
  latitude: number;
  longitude: number;
};

export type AmapJsMarker = {
  activeLabel?: string;
  activeLabelDesktopMaxLength?: number;
  activeLabelMobileMaxLength?: number;
  appearance?: "pin" | "routeStop";
  backgroundColor?: string;
  borderColor?: string;
  coordinate: AmapJsCoordinate;
  haloColor?: string;
  id: string;
  innerColor?: string;
  label?: string;
  scale?: number;
  textColor?: string;
  title?: string;
  zIndex?: number;
};

export type AmapJsPolyline = {
  color?: string;
  coordinates: AmapJsCoordinate[];
  dashArray?: number[];
  directionColor?: string;
  id: string;
  opacity?: number;
  outlineColor?: string;
  outlineWidth?: number;
  showDirection?: boolean;
  strokeStyle?: "dashed" | "solid";
  width?: number;
};

export type AmapJsPolygon = {
  fillColor?: string;
  fillOpacity?: number;
  id: string;
  paths: AmapJsCoordinate[][];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
};

export type AmapJsControlPosition = {
  bottom?: string;
  left?: string;
  right?: string;
  top?: string;
};

export type AmapJsFitViewControl = {
  label?: string;
  position?: AmapJsControlPosition;
  title?: string;
};

export type AmapJsFitPadding = [
  top: number,
  bottom: number,
  left: number,
  right: number,
];

export type AmapMapVisualPresetName =
  | "minimalBlue"
  | "naturalTravel"
  | "darkMinimal"
  | "nightTravel";

export type AmapMapVisualPreset = {
  backgroundColor: string;
  controlActiveBackground: string;
  controlBackground: string;
  controlBorderColor: string;
  controlColor: string;
  controlFocusOutlineColor: string;
  controlShadow: string;
  mapStyle: string;
  markerBackground: string;
  markerBorderColor: string;
  markerInnerColor: string;
  markerShadow: string;
  markerTextColor: string;
  name: AmapMapVisualPresetName;
  routeColor: string;
  routeOutlineColor: string;
};

export type AmapJsMapPayload = {
  center?: AmapJsCoordinate;
  fitCoordinates?: AmapJsCoordinate[];
  fitPadding?: AmapJsFitPadding;
  fitViewport?: {
    center: AmapJsCoordinate;
    zoom: number;
  };
  fitViewControl?: AmapJsFitViewControl;
  mapId: string;
  markers: AmapJsMarker[];
  maxFitZoom?: number;
  polylines: AmapJsPolyline[];
  polygons?: AmapJsPolygon[];
  showScale?: boolean;
  showToolbar?: boolean;
  toolbarPosition?: AmapJsControlPosition;
  visualPreset?: AmapMapVisualPresetName;
  zoom?: number;
};

export type AmapPreviewMapProps = {
  activeMarkerId?: string;
  center?: AmapJsCoordinate;
  fitCoordinates?: AmapJsCoordinate[];
  fitPadding?: AmapJsFitPadding;
  fitViewControl?: AmapJsFitViewControl;
  markers?: AmapJsMarker[];
  maxFitZoom?: number;
  onMarkerPress?: (markerId: string) => void;
  placeholderDescription?: string;
  placeholderTitle?: string;
  polylines?: AmapJsPolyline[];
  polygons?: AmapJsPolygon[];
  showScale?: boolean;
  showToolbar?: boolean;
  style?: StyleProp<ViewStyle>;
  toolbarPosition?: AmapJsControlPosition;
  visualPreset?: AmapMapVisualPresetName;
  zoom?: number;
};

export type AmapMapMessage = {
  activeMarkerId?: string;
  mapId?: string;
  markerId?: string;
  type?: string;
};

const AMAP_JS_API_URL = "https://webapi.amap.com/maps";
const DEFAULT_ZOOM = 15;
const DEFAULT_CENTER: AmapJsCoordinate = {
  latitude: 34.3416,
  longitude: 108.9398,
};

export const DEFAULT_AMAP_MAP_VISUAL_PRESET_NAME: AmapMapVisualPresetName =
  "naturalTravel";

export const AMAP_MAP_VISUAL_PRESETS: Record<
  AmapMapVisualPresetName,
  AmapMapVisualPreset
> = {
  minimalBlue: {
    backgroundColor: "#E5E7EB",
    controlActiveBackground: "#EFF6FF",
    controlBackground: "rgba(255, 255, 255, 0.96)",
    controlBorderColor: "rgba(37, 99, 235, 0.24)",
    controlColor: "#2563EB",
    controlFocusOutlineColor: "rgba(37, 99, 235, 0.42)",
    controlShadow: "0 5px 16px rgba(15, 23, 42, 0.16)",
    mapStyle: "amap://styles/whitesmoke",
    markerBackground: "#2563EB",
    markerBorderColor: "#FFFFFF",
    markerInnerColor: "#FFFFFF",
    markerShadow: "0 8px 20px rgba(15, 23, 42, 0.24)",
    markerTextColor: "#FFFFFF",
    name: "minimalBlue",
    routeColor: "#2563EB",
    routeOutlineColor: "rgba(255,255,255,0.92)",
  },
  naturalTravel: {
    backgroundColor: "#E8F4EC",
    controlActiveBackground: "#ECFDF5",
    controlBackground: "rgba(255, 255, 255, 0.94)",
    controlBorderColor: "rgba(20, 184, 166, 0.26)",
    controlColor: "#0F766E",
    controlFocusOutlineColor: "rgba(15, 118, 110, 0.38)",
    controlShadow: "0 6px 18px rgba(20, 83, 45, 0.16)",
    mapStyle: "amap://styles/macaron",
    markerBackground: "linear-gradient(135deg, #0F766E 0%, #22C55E 100%)",
    markerBorderColor: "#FFFBEB",
    markerInnerColor: "#FEF3C7",
    markerShadow: "0 9px 22px rgba(20, 83, 45, 0.26)",
    markerTextColor: "#FFFFFF",
    name: "naturalTravel",
    routeColor: "#0F766E",
    routeOutlineColor: "rgba(255, 251, 235, 0.94)",
  },
  darkMinimal: {
    backgroundColor: "#1A1816",
    controlActiveBackground: "#1E3A5F",
    controlBackground: "rgba(31, 28, 26, 0.96)",
    controlBorderColor: "rgba(96, 165, 250, 0.24)",
    controlColor: "#60A5FA",
    controlFocusOutlineColor: "rgba(96, 165, 250, 0.42)",
    controlShadow: "0 5px 16px rgba(0, 0, 0, 0.32)",
    mapStyle: "amap://styles/dark",
    markerBackground: "#60A5FA",
    markerBorderColor: "#1F1C1A",
    markerInnerColor: "#1F1C1A",
    markerShadow: "0 8px 20px rgba(0, 0, 0, 0.4)",
    markerTextColor: "#F5F4F2",
    name: "darkMinimal",
    routeColor: "#60A5FA",
    routeOutlineColor: "rgba(31, 28, 26, 0.92)",
  },
  nightTravel: {
    backgroundColor: "#0F1A14",
    controlActiveBackground: "#123528",
    controlBackground: "rgba(31, 28, 26, 0.94)",
    controlBorderColor: "rgba(52, 211, 153, 0.26)",
    controlColor: "#34D399",
    controlFocusOutlineColor: "rgba(52, 211, 153, 0.38)",
    controlShadow: "0 6px 18px rgba(0, 0, 0, 0.32)",
    mapStyle: "amap://styles/dark",
    markerBackground: "linear-gradient(135deg, #059669 0%, #34D399 100%)",
    markerBorderColor: "#1F1C1A",
    markerInnerColor: "#1A1816",
    markerShadow: "0 9px 22px rgba(0, 0, 0, 0.4)",
    markerTextColor: "#F5F4F2",
    name: "nightTravel",
    routeColor: "#34D399",
    routeOutlineColor: "rgba(31, 28, 26, 0.94)",
  },
};

export function getAmapMapVisualPreset(
  name?: AmapMapVisualPresetName,
  mode?: "light" | "dark",
): AmapMapVisualPreset {
  if (name) {
    return AMAP_MAP_VISUAL_PRESETS[name];
  }
  if (mode === "dark") {
    return AMAP_MAP_VISUAL_PRESETS.nightTravel;
  }
  return AMAP_MAP_VISUAL_PRESETS[DEFAULT_AMAP_MAP_VISUAL_PRESET_NAME];
}

function getAmapJsApiKey(): string {
  return process.env.EXPO_PUBLIC_AMAP_JS_API_KEY?.trim() ?? "";
}

function getAmapJsApiKeyPairs(cloudSecurityCodes?: {
  securityCode?: string;
  backupSecurityCode?: string;
}): { key: string; securityCode: string }[] {
  const pairs: { key: string; securityCode: string }[] = [];
  const primaryKey = getAmapJsApiKey();
  const primarySecurityCode = cloudSecurityCodes?.securityCode;

  if (primaryKey && primarySecurityCode) {
    pairs.push({ key: primaryKey, securityCode: primarySecurityCode });
  }

  const backupKey =
    process.env.EXPO_PUBLIC_AMAP_JS_API_KEY_BACKUP?.trim() ?? "";
  const backupSecurityCode = cloudSecurityCodes?.backupSecurityCode;

  if (backupKey && backupSecurityCode) {
    pairs.push({ key: backupKey, securityCode: backupSecurityCode });
  }

  return pairs;
}

export function isAmapJsApiConfigured(): boolean {
  return Boolean(getAmapJsApiKey());
}

function stringifyForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function getSafeNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getAmapFitViewport(
  coordinates: AmapJsCoordinate[],
  fitPadding: AmapJsFitPadding | undefined,
  mapSize: { height: number; width: number },
):
  | {
      center: AmapJsCoordinate;
      zoom: number;
    }
  | undefined {
  const viewport = getFittedViewport(coordinates, mapSize, {
    top: fitPadding?.[0] ?? 48,
    bottom: fitPadding?.[1] ?? 48,
    left: fitPadding?.[2] ?? 36,
    right: fitPadding?.[3] ?? 36,
  });

  if (!viewport) {
    return undefined;
  }

  return {
    center: getCoordinateFromWorldPoint(
      {
        x: viewport.centerWorldX,
        y: viewport.centerWorldY,
      },
      viewport.zoom,
    ),
    zoom: viewport.zoom,
  };
}

function normalizeAmapJsMapPayload(payload: AmapJsMapPayload) {
  const firstPolygonCoordinate = payload.polygons?.find(
    (polygon) => polygon.paths.length > 0,
  )?.paths[0]?.[0];
  const center =
    payload.center ??
    payload.markers[0]?.coordinate ??
    payload.polylines[0]?.coordinates[0] ??
    firstPolygonCoordinate ??
    DEFAULT_CENTER;
  const visualPreset = getAmapMapVisualPreset(payload.visualPreset);

  return {
    ...payload,
    center,
    fitCoordinates: payload.fitCoordinates ?? [],
    fitPadding: payload.fitPadding ?? [48, 48, 36, 36],
    fitViewport: payload.fitViewport,
    fitViewControl: payload.fitViewControl
      ? {
          label: payload.fitViewControl.label ?? "回到地点",
          position: payload.fitViewControl.position ?? {
            right: "12px",
            top: "154px",
          },
          title: payload.fitViewControl.title ?? "回到当天地点视野",
        }
      : undefined,
    markers: payload.markers ?? [],
    maxFitZoom: getSafeNumber(payload.maxFitZoom, 17),
    polygons: payload.polygons ?? [],
    polylines: payload.polylines ?? [],
    showScale: payload.showScale ?? true,
    showToolbar: payload.showToolbar ?? true,
    toolbarPosition: payload.toolbarPosition ?? {
      right: "12px",
      top: "12px",
    },
    visualPreset,
    zoom: getSafeNumber(payload.zoom, DEFAULT_ZOOM),
  };
}

export function parseAmapMapMessage(raw: unknown): AmapMapMessage | undefined {
  const parsed = typeof raw === "string" ? safeJsonParse(raw) : raw;

  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }

  const source = parsed as Record<string, unknown>;

  return {
    activeMarkerId:
      typeof source.activeMarkerId === "string"
        ? source.activeMarkerId
        : undefined,
    mapId: typeof source.mapId === "string" ? source.mapId : undefined,
    markerId: typeof source.markerId === "string" ? source.markerId : undefined,
    type: typeof source.type === "string" ? source.type : undefined,
  };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function buildAmapJsMapHtml(
  payload: AmapJsMapPayload,
  cloudSecurityCodes?: {
    securityCode?: string;
    backupSecurityCode?: string;
  },
): string {
  const keyPairs = getAmapJsApiKeyPairs(cloudSecurityCodes);
  const htmlPayload = normalizeAmapJsMapPayload(payload);
  const visualPreset = htmlPayload.visualPreset;

  const fallbackKeysJson = stringifyForInlineScript(keyPairs);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html,
      body,
      #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: ${visualPreset.backgroundColor};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .marker {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: var(--marker-opacity, 1);
        background: var(--marker-bg, ${visualPreset.markerBackground});
        color: var(--marker-text, ${visualPreset.markerTextColor});
        box-shadow: 0 0 0 6px var(--marker-halo, rgba(15, 118, 110, 0.16)), ${visualPreset.markerShadow};
        transition: opacity 160ms ease-out;
      }

      .marker:not(.marker-route-stop).marker-active {
        --marker-bg: #DC2626;
        --marker-halo: rgba(220, 38, 38, 0.25);
        --marker-scale: 1.12;
      }

      .marker-route-stop {
        border: 0;
        box-shadow: none;
        transition: opacity 160ms ease-out, min-width 160ms ease-out;
      }

      .marker-route-stop.marker-active {
        --marker-scale: 1;
        --marker-halo: transparent;
      }

      .marker-route-stop .marker-name {
        display: block;
        max-width: 0;
        margin-left: 0;
        overflow: hidden;
        opacity: 0;
        transition: max-width 160ms ease-out, margin-left 160ms ease-out, opacity 120ms ease-out;
        white-space: nowrap;
      }

      .marker-route-stop.marker-active .marker-name {
        max-width: 10em;
        margin-left: 5px;
        opacity: 1;
      }

      .marker-label {
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border: 2px solid var(--marker-border, ${visualPreset.markerBorderColor});
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        transform: translate(-50%, -50%) scale(var(--marker-scale, 1));
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.18);
      }

      .marker-label.marker-route-stop {
        min-width: 22px;
        padding: 0 7px;
        border: 0;
        box-shadow: none;
      }

      .marker-pin {
        width: 26px;
        height: 26px;
        border: 2px solid var(--marker-border, ${visualPreset.markerBorderColor});
        border-radius: 999px 999px 999px 5px;
        transform: translate(-50%, -88%) rotate(-45deg) scale(var(--marker-scale, 1));
        box-shadow: 0 1px 4px rgba(0,0,0,0.18);
      }

      .marker-pin span {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--marker-inner, ${visualPreset.markerInnerColor});
      }

      .fit-coordinate-marker {
        width: 0;
        height: 0;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
      }

      .amap-toolbar,
      .amap-zoom {
        display: none !important;
      }

      .zoom-controls {
        position: absolute;
        z-index: 999;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        width: 36px;
        min-height: 74px;
        border-radius: 999px;
        overflow: hidden;
        background: ${visualPreset.controlBackground};
        border: 1px solid ${visualPreset.controlBorderColor};
        box-shadow: ${visualPreset.controlShadow};
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }
      .zoom-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 100%;
        height: 36px;
        padding: 0;
        border: none;
        background: transparent;
        color: ${visualPreset.controlColor};
        font-size: 18px;
        font-weight: 700;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        line-height: 1;
      }
      .zoom-btn + .zoom-btn {
        border-top: 1px solid ${visualPreset.controlBorderColor};
      }
      .zoom-btn:active {
        background: ${visualPreset.controlActiveBackground};
      }
      .zoom-btn:focus-visible {
        outline: 2px solid ${visualPreset.controlFocusOutlineColor};
        outline-offset: -3px;
      }

      .fit-view-button {
        position: absolute;
        z-index: 999;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 36px;
        min-width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid ${visualPreset.controlBorderColor};
        border-radius: 18px;
        background: ${visualPreset.controlBackground};
        color: ${visualPreset.controlColor};
        box-shadow: ${visualPreset.controlShadow};
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      .fit-view-button:active {
        background: ${visualPreset.controlActiveBackground};
      }

      .fit-view-button:focus-visible {
        outline: 2px solid ${visualPreset.controlFocusOutlineColor};
        outline-offset: 2px;
      }

      .fit-view-button svg {
        display: block;
        width: 16px;
        height: 16px;
      }
    </style>
    <script>
      var _keyPairs = ${fallbackKeysJson};
      var _currentKeyIndex = 0;
      var _amapInitRequestId = 0;
      var _amapInitTimeoutMs = 6000;
      var _amapScriptElement = null;
      var _amapStatus = {
        lastError: "",
        ready: false
      };

      function _resetAmapGlobal() {
        try {
          delete window.AMap;
        } catch (_) {
          window.AMap = undefined;
        }
      }

      function _cleanupAmapScript() {
        if (_amapScriptElement && _amapScriptElement.parentNode) {
          _amapScriptElement.parentNode.removeChild(_amapScriptElement);
        }
        _amapScriptElement = null;
      }

      function _markAmapFailure(index, requestId, reason) {
        if (requestId !== _amapInitRequestId || index !== _currentKeyIndex) {
          return;
        }

        _amapStatus.lastError = String(reason || "AMap init failed");
        _amapStatus.ready = false;
        _cleanupAmapScript();
        _resetAmapGlobal();
        _loadAmapScript(index + 1);
      }

      function _markAmapReady(index, requestId) {
        if (requestId !== _amapInitRequestId || index !== _currentKeyIndex) {
          return;
        }

        _amapStatus.ready = true;
        window.dispatchEvent(new CustomEvent("amap-ready"));
      }

      function _retryAmapWithNextKey(reason) {
        _markAmapFailure(_currentKeyIndex, _amapInitRequestId, reason);
      }

      function _loadAmapScript(index) {
        if (index >= _keyPairs.length) {
          _amapStatus.lastError = _amapStatus.lastError || "All AMap keys failed";
          window.dispatchEvent(new CustomEvent("amap-failed", {
            detail: {
              error: _amapStatus.lastError
            }
          }));
          return;
        }

        var pair = _keyPairs[index];
        var requestId = ++_amapInitRequestId;
        _currentKeyIndex = index;
        _amapStatus.ready = false;
        window._AMapSecurityConfig = { securityJsCode: pair.securityCode };
        _cleanupAmapScript();
        _resetAmapGlobal();

        var timeoutId = window.setTimeout(function () {
          _markAmapFailure(index, requestId, "AMap init timeout");
        }, _amapInitTimeoutMs);

        var script = document.createElement('script');
        _amapScriptElement = script;
        script.src = '${AMAP_JS_API_URL}?v=2.0&key=' + encodeURIComponent(pair.key) + '&plugin=AMap.Scale,AMap.ToolBar';
        script.onerror = function() {
          window.clearTimeout(timeoutId);
          _markAmapFailure(index, requestId, "AMap script load error");
        };
        script.onload = function() {
          if (requestId !== _amapInitRequestId || index !== _currentKeyIndex) {
            window.clearTimeout(timeoutId);
            return;
          }

          var attempts = 0;

          function finishIfReady() {
            if (requestId !== _amapInitRequestId || index !== _currentKeyIndex) {
              window.clearTimeout(timeoutId);
              return;
            }

            if (window.AMap && typeof window.AMap.Map === "function") {
              window.clearTimeout(timeoutId);
              _markAmapReady(index, requestId);
              return;
            }

            attempts += 1;
            if (attempts >= 20) {
              window.clearTimeout(timeoutId);
              _markAmapFailure(index, requestId, "AMap global unavailable");
              return;
            }

            window.setTimeout(finishIfReady, 120);
          }

          finishIfReady();
        };
        document.head.appendChild(script);
      }

      _loadAmapScript(0);
    </script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      (function () {
        var payload = ${stringifyForInlineScript(htmlPayload)};
        var visualPresets = ${stringifyForInlineScript(AMAP_MAP_VISUAL_PRESETS)};
        var markerOverlaysById = {};
        var currentActiveMarkerId = "";
        var mapInstance = null;
        var dynamicOverlays = [];
        var primaryFitOverlays = [];
        var fallbackFitOverlays = [];
        var zoomControls = null;
        var fitButton = null;
        var updatePayloadApi = null;
        var pendingPayloadUpdate = null;

        function toLngLat(coordinate) {
          return [coordinate.longitude, coordinate.latitude];
        }

        function isCoordinate(coordinate) {
          return coordinate &&
            Number.isFinite(coordinate.latitude) &&
            Number.isFinite(coordinate.longitude) &&
            Math.abs(coordinate.latitude) <= 90 &&
            Math.abs(coordinate.longitude) <= 180;
        }

        function escapeHtml(value) {
          return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        }

        function createMarkerStyle(marker, startsHidden) {
          var styles = [];

          if (startsHidden) {
            styles.push("--marker-opacity:0");
          }

          if (marker.backgroundColor) {
            styles.push("--marker-bg:" + marker.backgroundColor);
          }

          if (marker.borderColor) {
            styles.push("--marker-border:" + marker.borderColor);
          }

          if (marker.haloColor) {
            styles.push("--marker-halo:" + marker.haloColor);
          }

          if (marker.innerColor) {
            styles.push("--marker-inner:" + marker.innerColor);
          }

          if (marker.textColor) {
            styles.push("--marker-text:" + marker.textColor);
          }

          if (typeof marker.scale === "number" && Number.isFinite(marker.scale) && marker.scale > 0) {
            styles.push("--marker-scale:" + marker.scale);
          }

          return styles.length > 0 ? ' style="' + escapeHtml(styles.join(";")) + '"' : "";
        }

        function createMarkerContent(marker, startsHidden) {
          var label = String(marker.label || "").trim();
          var style = createMarkerStyle(marker, startsHidden);
          var markerId = escapeHtml(marker.id || "");

          if (label) {
            if (marker.appearance === "routeStop") {
              var maxLength = window.innerWidth <= 640
                ? marker.activeLabelMobileMaxLength
                : marker.activeLabelDesktopMaxLength;
              var activeLabel = String(marker.activeLabel || "").trim();

              if (typeof maxLength === "number" && Number.isFinite(maxLength) && maxLength > 0 && activeLabel.length > maxLength) {
                activeLabel = activeLabel.slice(0, maxLength) + "…";
              }

              return '<div class="marker marker-label marker-route-stop" data-marker-id="' + markerId + '"' + style + '><span class="marker-sequence">' + escapeHtml(label) + '</span><span class="marker-name">' + escapeHtml(activeLabel) + '</span></div>';
            }

            return '<div class="marker marker-label" data-marker-id="' + markerId + '"' + style + ">" + escapeHtml(label) + "</div>";
          }

          return '<div class="marker marker-pin" data-marker-id="' + markerId + '"' + style + "><span></span></div>";
        }

        function postMessage(message) {
          var raw = JSON.stringify(Object.assign({ mapId: payload.mapId }, message));

          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
            window.ReactNativeWebView.postMessage(raw);
          }

          if (window.parent && window.parent !== window) {
            window.parent.postMessage(raw, "*");
          }
        }

        function applyPosition(element, position) {
          Object.keys(position || {}).forEach(function (key) {
            element.style[key] = position[key];
          });
        }

        function getValidPath(coordinates) {
          if (!Array.isArray(coordinates)) {
            return [];
          }

          return coordinates.filter(isCoordinate).map(toLngLat);
        }

        function getVisualPreset(value) {
          if (typeof value === "string" && visualPresets[value]) {
            return visualPresets[value];
          }

          if (value && typeof value === "object" && value.mapStyle) {
            return value;
          }

          return payload.visualPreset;
        }

        function getSafeNumber(value, fallback) {
          return typeof value === "number" && Number.isFinite(value) ? value : fallback;
        }

        function getSafeFitPadding(value, fallback) {
          if (!Array.isArray(value) || value.length < 4) {
            return fallback;
          }

          return [0, 1, 2, 3].map(function (index) {
            var entry = value[index];
            return typeof entry === "number" && Number.isFinite(entry) ? entry : fallback[index];
          });
        }

        function getFirstPolygonCoordinate(polygons) {
          if (!Array.isArray(polygons)) {
            return undefined;
          }

          for (var polygonIndex = 0; polygonIndex < polygons.length; polygonIndex += 1) {
            var polygon = polygons[polygonIndex];
            if (!polygon || !Array.isArray(polygon.paths)) {
              continue;
            }

            for (var pathIndex = 0; pathIndex < polygon.paths.length; pathIndex += 1) {
              var path = polygon.paths[pathIndex];
              if (Array.isArray(path) && isCoordinate(path[0])) {
                return path[0];
              }
            }
          }

          return undefined;
        }

        function normalizeRuntimePayload(nextPayload) {
          var source = nextPayload && typeof nextPayload === "object" ? nextPayload : {};
          var markers = Array.isArray(source.markers) ? source.markers : [];
          var polylines = Array.isArray(source.polylines) ? source.polylines : [];
          var polygons = Array.isArray(source.polygons) ? source.polygons : [];
          var firstPolygonCoordinate = getFirstPolygonCoordinate(polygons);
          var center = isCoordinate(source.center)
            ? source.center
            : markers[0] && isCoordinate(markers[0].coordinate)
              ? markers[0].coordinate
              : polylines[0] && Array.isArray(polylines[0].coordinates) && isCoordinate(polylines[0].coordinates[0])
                ? polylines[0].coordinates[0]
                : firstPolygonCoordinate || payload.center;
          var fitViewControl = source.fitViewControl
            ? Object.assign(
                {
                  label: "回到地点",
                  position: { right: "12px", top: "154px" },
                  title: "回到当天地点视野"
                },
                source.fitViewControl
              )
            : undefined;

          return Object.assign({}, payload, source, {
            center: center,
            fitCoordinates: Array.isArray(source.fitCoordinates) ? source.fitCoordinates : [],
            fitPadding: getSafeFitPadding(source.fitPadding, payload.fitPadding),
            fitViewport:
              source.fitViewport &&
              isCoordinate(source.fitViewport.center) &&
              typeof source.fitViewport.zoom === "number" &&
              Number.isFinite(source.fitViewport.zoom)
                ? source.fitViewport
                : undefined,
            fitViewControl: fitViewControl,
            mapId: payload.mapId,
            markers: markers,
            maxFitZoom: getSafeNumber(source.maxFitZoom, payload.maxFitZoom),
            polygons: polygons,
            polylines: polylines,
            showScale: source.showScale !== false,
            showToolbar: source.showToolbar !== false,
            toolbarPosition: source.toolbarPosition || payload.toolbarPosition,
            visualPreset: getVisualPreset(source.visualPreset),
            zoom: getSafeNumber(source.zoom, payload.zoom)
          });
        }

        function applyActiveMarkerId(markerId) {
          currentActiveMarkerId = String(markerId || "");

          document.querySelectorAll(".marker[data-marker-id]").forEach(function (element) {
            var isActive = element.getAttribute("data-marker-id") === currentActiveMarkerId;
            element.classList.toggle("marker-active", isActive);
          });

          Object.keys(markerOverlaysById).forEach(function (markerKey) {
            var overlay = markerOverlaysById[markerKey];

            if (overlay && typeof overlay.setzIndex === "function") {
              overlay.setzIndex(markerKey === currentActiveMarkerId ? 80 : 40);
            }
          });
        }

        var mapCreated = false;
        var fitToOverlaysApi = null;
        var pendingFitViewOptions = null;
        var pendingFitViewTimer = 0;
        var cameraAnimationFrame = 0;
        var overlayAnimationFrame = 0;

        function cancelOverlayAnimation() {
          if (overlayAnimationFrame) {
            window.cancelAnimationFrame(overlayAnimationFrame);
            overlayAnimationFrame = 0;
          }
        }

        function animateOverlayEntrance(transitions) {
          cancelOverlayAnimation();

          document.querySelectorAll(".marker[data-marker-id]").forEach(function (element) {
            element.style.setProperty("--marker-opacity", "1");
          });

          if (transitions.length === 0) {
            return;
          }

          var durationMs = 160;
          var startTime = 0;

          function step(timestamp) {
            if (!startTime) {
              startTime = timestamp;
            }

            var progress = Math.min(1, (timestamp - startTime) / durationMs);
            var eased = 1 - Math.pow(1 - progress, 3);

            transitions.forEach(function (applyProgress) {
              applyProgress(eased);
            });

            if (progress < 1) {
              overlayAnimationFrame = window.requestAnimationFrame(step);
            } else {
              overlayAnimationFrame = 0;
            }
          }

          overlayAnimationFrame = window.requestAnimationFrame(step);
        }

        function requestPayloadUpdate(nextPayload, options) {
          if (typeof updatePayloadApi !== "function") {
            pendingPayloadUpdate = { payload: nextPayload, options: options };
            return;
          }

          updatePayloadApi(nextPayload, options);
        }

        function requestFitView(options) {
          pendingFitViewOptions = Object.assign({}, pendingFitViewOptions || {}, options || {});

          if (pendingFitViewTimer) {
            window.clearTimeout(pendingFitViewTimer);
            pendingFitViewTimer = 0;
          }

          if (typeof fitToOverlaysApi !== "function") {
            return;
          }

          var delayMs =
            typeof pendingFitViewOptions.delayMs === "number" && Number.isFinite(pendingFitViewOptions.delayMs)
              ? Math.max(0, Math.min(240, pendingFitViewOptions.delayMs))
              : 0;

          pendingFitViewTimer = window.setTimeout(function () {
            var nextFitViewOptions = pendingFitViewOptions;
            pendingFitViewOptions = null;
            pendingFitViewTimer = 0;
            fitToOverlaysApi(nextFitViewOptions);
          }, delayMs);
        }

        function removeDynamicOverlays() {
          cancelOverlayAnimation();

          if (!mapInstance || dynamicOverlays.length === 0) {
            dynamicOverlays = [];
            return;
          }

          mapInstance.remove(dynamicOverlays);
          dynamicOverlays = [];
        }

        function setFitButton(payloadForRender) {
          if (fitButton && fitButton.parentNode) {
            fitButton.parentNode.removeChild(fitButton);
          }

          fitButton = null;

          if (!payloadForRender.fitViewControl) {
            return;
          }

          fitButton = document.createElement("button");
          fitButton.className = "fit-view-button";
          fitButton.type = "button";
          fitButton.setAttribute("aria-label", payloadForRender.fitViewControl.label);
          fitButton.title = payloadForRender.fitViewControl.title;
          fitButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M12 2.75v3.5M12 17.75v3.5M2.75 12h3.5M17.75 12h3.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path><circle cx="12" cy="12" r="1.6" fill="currentColor"></circle></svg>';
          applyPosition(fitButton, payloadForRender.fitViewControl.position);
          fitButton.addEventListener("click", function () {
            if (typeof fitToOverlaysApi === "function") {
              fitToOverlaysApi();
            }
          });
          document.body.appendChild(fitButton);
        }

        function renderDynamicOverlays(payloadForRender) {
          if (!mapInstance) {
            return;
          }

          removeDynamicOverlays();
          markerOverlaysById = {};
          primaryFitOverlays = [];
          fallbackFitOverlays = [];
          var entranceTransitions = [];

          var hasRouteGeometry = payloadForRender.polylines.some(function (polyline) {
            return Array.isArray(polyline.coordinates) && polyline.coordinates.length >= 2;
          });
          var hasPolygonGeometry = payloadForRender.polygons.some(function (polygon) {
            return Array.isArray(polygon.paths) && polygon.paths.some(function (path) {
              return Array.isArray(path) && path.length >= 3;
            });
          });
          var shouldFitMarkers =
            payloadForRender.fitCoordinates.length > 0 ||
            payloadForRender.markers.length > 1 ||
            hasRouteGeometry ||
            hasPolygonGeometry;

          payloadForRender.polygons.forEach(function (polygon, index) {
            if (!Array.isArray(polygon.paths)) {
              return;
            }

            polygon.paths.forEach(function (path, pathIndex) {
              var validPath = getValidPath(path);

              if (validPath.length < 3) {
                return;
              }

              var targetFillOpacity = typeof polygon.fillOpacity === "number" ? polygon.fillOpacity : 0.1;
              var targetStrokeOpacity = typeof polygon.strokeOpacity === "number" ? polygon.strokeOpacity : 0.38;
              var overlay = new AMap.Polygon({
                bubble: true,
                fillColor: polygon.fillColor || "#60a5fa",
                fillOpacity: 0,
                path: validPath,
                strokeColor: polygon.strokeColor || "#2563eb",
                strokeOpacity: 0,
                strokeWeight: polygon.strokeWidth || 2,
                zIndex: 14 + index + pathIndex
              });

              entranceTransitions.push(function (progress) {
                overlay.setOptions({
                  fillOpacity: targetFillOpacity * progress,
                  strokeOpacity: targetStrokeOpacity * progress
                });
              });

              fallbackFitOverlays.push(overlay);
              dynamicOverlays.push(overlay);
            });
          });

          payloadForRender.polylines.forEach(function (polyline, index) {
            if (!Array.isArray(polyline.coordinates) || polyline.coordinates.length < 2) {
              return;
            }

            var targetStrokeOpacity = typeof polyline.opacity === "number" ? polyline.opacity : 0.88;
            var polylineOptions = {
              borderWeight: typeof polyline.outlineWidth === "number" ? polyline.outlineWidth : 1,
              geodesic: false,
              isOutline: true,
              lineCap: "round",
              lineJoin: "round",
              outlineColor: polyline.outlineColor || payloadForRender.visualPreset.routeOutlineColor,
              path: polyline.coordinates.map(toLngLat),
              showDir: Boolean(polyline.showDirection),
              strokeColor: polyline.color || payloadForRender.visualPreset.routeColor,
              strokeOpacity: 0,
              strokeWeight: polyline.width || 5,
              zIndex: index === 0 ? 20 : 16
            };

            if (polyline.directionColor) {
              polylineOptions.dirColor = polyline.directionColor;
            }

            if (polyline.strokeStyle) {
              polylineOptions.strokeStyle = polyline.strokeStyle;
            }

            if (Array.isArray(polyline.dashArray) && polyline.dashArray.length > 0) {
              polylineOptions.strokeDasharray = polyline.dashArray;
            }

            var overlay = new AMap.Polyline(polylineOptions);
            entranceTransitions.push(function (progress) {
              overlay.setOptions({ strokeOpacity: targetStrokeOpacity * progress });
            });
            primaryFitOverlays.push(overlay);
            dynamicOverlays.push(overlay);
          });

          payloadForRender.markers.forEach(function (marker) {
            if (!isCoordinate(marker.coordinate)) {
              return;
            }

            var overlay = new AMap.Marker({
              anchor: "center",
              content: createMarkerContent(marker, true),
              offset: new AMap.Pixel(0, 0),
              position: toLngLat(marker.coordinate),
              title: marker.title || marker.label || "",
              zIndex: marker.zIndex || 40
            });

            overlay.on("click", function () {
              postMessage({
                type: "markerPress",
                markerId: marker.id
              });
            });

            markerOverlaysById[marker.id] = overlay;
            dynamicOverlays.push(overlay);

            if (shouldFitMarkers && (payloadForRender.markers.length > 1 || hasRouteGeometry)) {
              primaryFitOverlays.push(overlay);
            } else if (shouldFitMarkers) {
              fallbackFitOverlays.push(overlay);
            }
          });

          var fitCoordinatePath = getValidPath(payloadForRender.fitCoordinates);

          if (fitCoordinatePath.length >= 3) {
            var fitPolygon = new AMap.Polygon({
              bubble: true,
              fillOpacity: 0,
              path: fitCoordinatePath,
              strokeOpacity: 0,
              strokeWeight: 0,
              zIndex: -1
            });

            fallbackFitOverlays.push(fitPolygon);
            dynamicOverlays.push(fitPolygon);
          } else if (fitCoordinatePath.length >= 2) {
            var fitPolyline = new AMap.Polyline({
              path: fitCoordinatePath,
              strokeOpacity: 0,
              strokeWeight: 0,
              zIndex: -1
            });

            fallbackFitOverlays.push(fitPolyline);
            dynamicOverlays.push(fitPolyline);
          } else if (fitCoordinatePath.length === 1) {
            var fitMarker = new AMap.Marker({
              clickable: false,
              content: '<div class="fit-coordinate-marker" aria-hidden="true"></div>',
              offset: new AMap.Pixel(0, 0),
              opacity: 0,
              position: fitCoordinatePath[0],
              zIndex: -1
            });

            fallbackFitOverlays.push(fitMarker);
            dynamicOverlays.push(fitMarker);
          }

          if (dynamicOverlays.length > 0) {
            mapInstance.add(dynamicOverlays);
          }

          window.requestAnimationFrame(function () {
            animateOverlayEntrance(entranceTransitions);
          });

          setFitButton(payloadForRender);
          applyActiveMarkerId(currentActiveMarkerId);
        }

        function createMap() {
          if (mapCreated) {
            return;
          }

          mapCreated = true;

          try {
          primaryFitOverlays = [];
          fallbackFitOverlays = [];
          var hasRouteGeometry = payload.polylines.some(function (polyline) {
            return Array.isArray(polyline.coordinates) && polyline.coordinates.length >= 2;
          });
          var hasPolygonGeometry = payload.polygons.some(function (polygon) {
            return Array.isArray(polygon.paths) && polygon.paths.some(function (path) {
              return Array.isArray(path) && path.length >= 3;
            });
          });
          var shouldFitMarkers =
            payload.fitCoordinates.length > 0 || payload.markers.length > 1 || hasRouteGeometry || hasPolygonGeometry;
          var initialCenter =
            payload.fitViewport && isCoordinate(payload.fitViewport.center) ? payload.fitViewport.center : payload.center;
          var initialZoom =
            payload.fitViewport &&
            typeof payload.fitViewport.zoom === "number" &&
            Number.isFinite(payload.fitViewport.zoom)
              ? payload.fitViewport.zoom
              : payload.zoom;
          var map = new AMap.Map("map", {
            center: toLngLat(initialCenter),
            doubleClickZoom: true,
            dragEnable: true,
            jogEnable: true,
            pitchEnable: false,
            resizeEnable: true,
            rotateEnable: false,
            scrollWheel: true,
            touchZoom: true,
            viewMode: "2D",
            mapStyle: payload.visualPreset.mapStyle,
            zoom: initialZoom,
            zoomEnable: true
          });
          mapInstance = map;

          if (payload.showScale) {
            map.addControl(new AMap.Scale());
          }

          if (payload.showToolbar !== false) {
            zoomControls = document.createElement("div");
            zoomControls.className = "zoom-controls";
            var zoomInBtn = document.createElement("button");
            zoomInBtn.className = "zoom-btn";
            zoomInBtn.type = "button";
            zoomInBtn.setAttribute("aria-label", "放大");
            zoomInBtn.title = "放大";
            zoomInBtn.textContent = "+";
            var zoomOutBtn = document.createElement("button");
            zoomOutBtn.className = "zoom-btn";
            zoomOutBtn.type = "button";
            zoomOutBtn.setAttribute("aria-label", "缩小");
            zoomOutBtn.title = "缩小";
            zoomOutBtn.textContent = "−";
            zoomInBtn.addEventListener("click", function () { map.zoomIn(); });
            zoomOutBtn.addEventListener("click", function () { map.zoomOut(); });
            zoomControls.appendChild(zoomInBtn);
            zoomControls.appendChild(zoomOutBtn);
            applyPosition(zoomControls, payload.toolbarPosition ?? { right: '12px', top: '12px' });
            document.body.appendChild(zoomControls);
          }

          payload.polygons.forEach(function (polygon, index) {
            if (!Array.isArray(polygon.paths)) {
              return;
            }

            polygon.paths.forEach(function (path, pathIndex) {
              var validPath = getValidPath(path);

              if (validPath.length < 3) {
                return;
              }

              var overlay = new AMap.Polygon({
                bubble: true,
                fillColor: polygon.fillColor || "#60a5fa",
                fillOpacity: typeof polygon.fillOpacity === "number" ? polygon.fillOpacity : 0.1,
                path: validPath,
                strokeColor: polygon.strokeColor || "#2563eb",
                strokeOpacity: typeof polygon.strokeOpacity === "number" ? polygon.strokeOpacity : 0.38,
                strokeWeight: polygon.strokeWidth || 2,
                zIndex: 14 + index + pathIndex
              });

              map.add(overlay);
              dynamicOverlays.push(overlay);
              fallbackFitOverlays.push(overlay);
            });
          });

          payload.polylines.forEach(function (polyline, index) {
            if (!Array.isArray(polyline.coordinates) || polyline.coordinates.length < 2) {
              return;
            }

            var polylineOptions = {
              borderWeight: typeof polyline.outlineWidth === "number" ? polyline.outlineWidth : 1,
              geodesic: false,
              isOutline: true,
              lineCap: "round",
              lineJoin: "round",
              outlineColor: polyline.outlineColor || payload.visualPreset.routeOutlineColor,
              path: polyline.coordinates.map(toLngLat),
              showDir: Boolean(polyline.showDirection),
              strokeColor: polyline.color || payload.visualPreset.routeColor,
              strokeOpacity: typeof polyline.opacity === "number" ? polyline.opacity : 0.88,
              strokeWeight: polyline.width || 5,
              zIndex: index === 0 ? 20 : 16
            };

            if (polyline.directionColor) {
              polylineOptions.dirColor = polyline.directionColor;
            }

            if (polyline.strokeStyle) {
              polylineOptions.strokeStyle = polyline.strokeStyle;
            }

            if (Array.isArray(polyline.dashArray) && polyline.dashArray.length > 0) {
              polylineOptions.strokeDasharray = polyline.dashArray;
            }

            var overlay = new AMap.Polyline(polylineOptions);
            map.add(overlay);
            dynamicOverlays.push(overlay);
            primaryFitOverlays.push(overlay);
          });

          payload.markers.forEach(function (marker) {
            if (!isCoordinate(marker.coordinate)) {
              return;
            }

            var overlay = new AMap.Marker({
              anchor: "center",
              content: createMarkerContent(marker),
              offset: new AMap.Pixel(0, 0),
              position: toLngLat(marker.coordinate),
              title: marker.title || marker.label || "",
              zIndex: marker.zIndex || 40
            });

            overlay.on("click", function () {
              postMessage({
                type: "markerPress",
                markerId: marker.id
              });
            });

            map.add(overlay);
            dynamicOverlays.push(overlay);
            markerOverlaysById[marker.id] = overlay;

            if (shouldFitMarkers && (payload.markers.length > 1 || hasRouteGeometry)) {
              primaryFitOverlays.push(overlay);
            } else if (shouldFitMarkers) {
              fallbackFitOverlays.push(overlay);
            }
          });

          var fitCoordinatePath = getValidPath(payload.fitCoordinates);

          if (fitCoordinatePath.length >= 3) {
            var fitPolygon = new AMap.Polygon({
              bubble: true,
              fillOpacity: 0,
              path: fitCoordinatePath,
              strokeOpacity: 0,
              strokeWeight: 0,
              zIndex: -1
            });

            map.add(fitPolygon);
            dynamicOverlays.push(fitPolygon);
            fallbackFitOverlays.push(fitPolygon);
          } else if (fitCoordinatePath.length >= 2) {
            var fitPolyline = new AMap.Polyline({
              path: fitCoordinatePath,
              strokeOpacity: 0,
              strokeWeight: 0,
              zIndex: -1
            });

            map.add(fitPolyline);
            dynamicOverlays.push(fitPolyline);
            fallbackFitOverlays.push(fitPolyline);
          } else if (fitCoordinatePath.length === 1) {
            var fitMarker = new AMap.Marker({
              clickable: false,
              content: '<div class="fit-coordinate-marker" aria-hidden="true"></div>',
              offset: new AMap.Pixel(0, 0),
              opacity: 0,
              position: fitCoordinatePath[0],
              zIndex: -1
            });

            map.add(fitMarker);
            dynamicOverlays.push(fitMarker);
            fallbackFitOverlays.push(fitMarker);
          }

          var currentFitOptions = {
            fitPadding: payload.fitPadding,
            fitViewport: payload.fitViewport,
            maxFitZoom: payload.maxFitZoom
          };
          var lastAppliedFitPadding = payload.fitPadding;

          function getFitPaddingFromOptions(options) {
            var source = options && Array.isArray(options.fitPadding) ? options.fitPadding : payload.fitPadding;

            if (!Array.isArray(source) || source.length < 4) {
              return payload.fitPadding;
            }

            return [0, 1, 2, 3].map(function (index) {
              var value = source[index];
              return typeof value === "number" && Number.isFinite(value) ? value : payload.fitPadding[index];
            });
          }

          function getMaxFitZoomFromOptions(options) {
            var value = options && options.maxFitZoom;
            return typeof value === "number" && Number.isFinite(value) ? value : payload.maxFitZoom;
          }

          function getCameraDurationFromOptions(options) {
            var value = options && options.durationMs;
            return typeof value === "number" && Number.isFinite(value) ? Math.max(120, Math.min(900, value)) : 420;
          }

          function cancelCameraAnimation() {
            if (cameraAnimationFrame) {
              window.cancelAnimationFrame(cameraAnimationFrame);
              cameraAnimationFrame = 0;
            }
          }

          function getMapCenterCoordinate() {
            var center = map.getCenter && map.getCenter();
            var longitude =
              center && typeof center.getLng === "function"
                ? center.getLng()
                : center && typeof center.lng === "number"
                  ? center.lng
                  : center && typeof center.longitude === "number"
                    ? center.longitude
                    : undefined;
            var latitude =
              center && typeof center.getLat === "function"
                ? center.getLat()
                : center && typeof center.lat === "number"
                  ? center.lat
                  : center && typeof center.latitude === "number"
                    ? center.latitude
                    : undefined;

            if (typeof longitude !== "number" || !Number.isFinite(longitude) || typeof latitude !== "number" || !Number.isFinite(latitude)) {
              return undefined;
            }

            return {
              latitude: latitude,
              longitude: longitude
            };
          }

          function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          }

          function setCameraImmediately(zoom, center) {
            map.setZoomAndCenter(zoom, toLngLat(center), true);
          }

          function animateCameraTo(zoom, center, options) {
            cancelCameraAnimation();

            if (!options || options.animate === false) {
              setCameraImmediately(zoom, center);
              return;
            }

            var startCenter = getMapCenterCoordinate();
            var startZoom = map.getZoom && map.getZoom();
            var targetZoom = typeof zoom === "number" && Number.isFinite(zoom) ? zoom : startZoom;

            if (!startCenter || typeof startZoom !== "number" || !Number.isFinite(startZoom) || !isCoordinate(center)) {
              setCameraImmediately(targetZoom, center);
              return;
            }

            var durationMs = getCameraDurationFromOptions(options);
            var startTime = 0;

            function step(timestamp) {
              if (!startTime) {
                startTime = timestamp;
              }

              var progress = Math.min(1, (timestamp - startTime) / durationMs);
              var eased = easeInOutCubic(progress);
              var nextCenter = {
                latitude: startCenter.latitude + (center.latitude - startCenter.latitude) * eased,
                longitude: startCenter.longitude + (center.longitude - startCenter.longitude) * eased
              };
              var nextZoom = startZoom + (targetZoom - startZoom) * eased;

              setCameraImmediately(nextZoom, nextCenter);

              if (progress < 1) {
                cameraAnimationFrame = window.requestAnimationFrame(step);
              } else {
                cameraAnimationFrame = 0;
                setCameraImmediately(targetZoom, center);
              }
            }

            cameraAnimationFrame = window.requestAnimationFrame(step);
          }

          function animateFitToOverlays(fitOverlays, targetPadding, maxFitZoom, options) {
            cancelCameraAnimation();
            var immediately = Boolean(options && options.animate === false);
            map.setFitView(
              fitOverlays,
              immediately,
              targetPadding,
              maxFitZoom
            );
            lastAppliedFitPadding = targetPadding;
          }

          function fitToOverlays(options) {
            if (options) {
              currentFitOptions = Object.assign({}, currentFitOptions, options);
            }

            if (
              currentFitOptions.fitViewport &&
              isCoordinate(currentFitOptions.fitViewport.center) &&
              typeof currentFitOptions.fitViewport.zoom === "number" &&
              Number.isFinite(currentFitOptions.fitViewport.zoom)
            ) {
              animateCameraTo(currentFitOptions.fitViewport.zoom, currentFitOptions.fitViewport.center, currentFitOptions);
              return;
            }

            var fitOverlays = primaryFitOverlays.length > 0 ? primaryFitOverlays : fallbackFitOverlays;

            if (fitOverlays.length > 0) {
              animateFitToOverlays(
                fitOverlays,
                getFitPaddingFromOptions(currentFitOptions),
                getMaxFitZoomFromOptions(currentFitOptions),
                currentFitOptions
              );
              return;
            }

            map.setZoomAndCenter(payload.zoom, toLngLat(payload.center));
          }

          updatePayloadApi = function (nextPayload, options) {
            var normalizedPayload = normalizeRuntimePayload(nextPayload);
            payload = normalizedPayload;

            currentFitOptions = {
              fitPadding: normalizedPayload.fitPadding,
              fitViewport: normalizedPayload.fitViewport,
              maxFitZoom: normalizedPayload.maxFitZoom
            };
            lastAppliedFitPadding = normalizedPayload.fitPadding;

            if (map && typeof map.setMapStyle === "function") {
              map.setMapStyle(normalizedPayload.visualPreset.mapStyle);
            }

            if (zoomControls) {
              applyPosition(zoomControls, normalizedPayload.toolbarPosition || { right: "12px", top: "12px" });
              zoomControls.style.display = normalizedPayload.showToolbar === false ? "none" : "";
            }

            renderDynamicOverlays(normalizedPayload);
            requestFitView(
              Object.assign(
                {
                  delayMs: 40,
                  durationMs: 460,
                  fitPadding: normalizedPayload.fitPadding,
                  maxFitZoom: normalizedPayload.maxFitZoom
                },
                options || {}
              )
            );
          };

          fitToOverlaysApi = fitToOverlays;
          if (pendingPayloadUpdate) {
            var queuedPayloadUpdate = pendingPayloadUpdate;
            pendingPayloadUpdate = null;
            updatePayloadApi(queuedPayloadUpdate.payload, queuedPayloadUpdate.options);
          }
          if (pendingFitViewOptions) {
            var queuedFitViewOptions = pendingFitViewOptions;
            pendingFitViewOptions = null;
            var queuedDelayMs =
              typeof queuedFitViewOptions.delayMs === "number" && Number.isFinite(queuedFitViewOptions.delayMs)
                ? Math.max(0, Math.min(240, queuedFitViewOptions.delayMs))
                : 0;
            window.setTimeout(function () {
              fitToOverlays(queuedFitViewOptions);
            }, queuedDelayMs);
          }

          setFitButton(payload);

          applyActiveMarkerId(currentActiveMarkerId);

          if (payload.fitViewport || primaryFitOverlays.length > 0 || fallbackFitOverlays.length > 0) {
            window.setTimeout(function () {
              fitToOverlays();
            }, 80);
          }

          window.addEventListener("resize", function () {
            map.resize();
          });
          } catch (error) {
            mapCreated = false;
            _retryAmapWithNextKey(error && error.message ? error.message : String(error || "AMap createMap failed"));
          }
        }

        window.__setAmapActiveMarkerId = applyActiveMarkerId;
        window.__waylogFitView = function (options) {
          requestFitView(options);
        };
        window.__waylogUpdatePayload = function (nextPayload, options) {
          requestPayloadUpdate(nextPayload, options);
        };

        window.addEventListener("message", function (event) {
          var message = event.data;

          if (typeof message === "string") {
            try {
              message = JSON.parse(message);
            } catch (_) {
              return;
            }
          }

          if (!message || message.mapId !== payload.mapId) {
            return;
          }

          if (message.type === "activeMarker") {
            applyActiveMarkerId(message.activeMarkerId);
          } else if (message.type === "fitView") {
            requestFitView(message);
          } else if (message.type === "updatePayload") {
            requestPayloadUpdate(message.payload, message.options);
          }
        });

        if (window.AMap && typeof window.AMap.Map === "function") {
          createMap();
        } else {
          window.addEventListener("amap-ready", function () {
            if (!mapCreated) {
              createMap();
            }
          });
        }
      })();
    </script>
  </body>
</html>`;
}
