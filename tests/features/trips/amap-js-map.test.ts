import assert from "node:assert/strict";
import test from "node:test";

import {
  type AmapJsMapPayload,
  type AmapMapVisualPresetName,
  buildAmapJsMapHtml,
} from "../../../features/trips/amap-js-map";

function getInlinePayload(html: string): Record<string, unknown> {
  const match = html.match(/var payload = (.*?);\n/s);

  if (!match?.[1]) {
    throw new Error("expected generated map html to include an inline payload");
  }

  return JSON.parse(match[1]) as Record<string, unknown>;
}

function buildPayload(input: Partial<AmapJsMapPayload> = {}): AmapJsMapPayload {
  return {
    mapId: "test-map",
    markers: [],
    polylines: [],
    ...input,
  };
}

test("地图各主题保留供应商默认版权与标识样式", () => {
  const presets: AmapMapVisualPresetName[] = [
    "minimalBlue",
    "naturalTravel",
    "darkMinimal",
    "nightTravel",
  ];

  for (const visualPreset of presets) {
    const html = buildAmapJsMapHtml(buildPayload({ visualPreset }));
    const styles = Array.from(
      html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g),
      (match) => match[1],
    ).join("\n");

    assert.equal(
      /\.amap-(?:logo|copyright)\b/.test(styles),
      false,
      visualPreset,
    );
  }
});

test("buildAmapJsMapHtml keeps Amap fit padding in top-bottom-left-right order", () => {
  process.env.EXPO_PUBLIC_AMAP_JS_API_KEY = "test-key";

  const defaultPayload = getInlinePayload(
    buildAmapJsMapHtml(buildPayload(), {
      securityCode: "test-security-code",
    }),
  );
  assert.deepEqual(defaultPayload.fitPadding, [48, 48, 36, 36]);

  const customPayload = getInlinePayload(
    buildAmapJsMapHtml(
      buildPayload({
        fitPadding: [72, 320, 36, 36],
      }),
      {
        securityCode: "test-security-code",
      },
    ),
  );
  assert.deepEqual(customPayload.fitPadding, [72, 320, 36, 36]);
});

test("buildAmapJsMapHtml inlines primary and backup JS API keys with failover hooks", () => {
  process.env.EXPO_PUBLIC_AMAP_JS_API_KEY = "primary-key";
  process.env.EXPO_PUBLIC_AMAP_JS_API_KEY_BACKUP = "backup-key";

  const html = buildAmapJsMapHtml(buildPayload(), {
    securityCode: "primary-security",
    backupSecurityCode: "backup-security",
  });

  assert.match(html, /primary-key/);
  assert.match(html, /primary-security/);
  assert.match(html, /backup-key/);
  assert.match(html, /backup-security/);
  assert.match(html, /function _retryAmapWithNextKey/);
  assert.match(html, /AMap init timeout/);
  assert.match(html, /AMap global unavailable/);
});

test("route fit delegates camera motion to one AMap setFitView call", () => {
  process.env.EXPO_PUBLIC_AMAP_JS_API_KEY = "test-key";

  const html = buildAmapJsMapHtml(buildPayload(), {
    securityCode: "test-security-code",
  });
  const fitAnimation = html.match(
    /function animateFitToOverlays[\s\S]*?function fitToOverlays/,
  )?.[0];

  if (!fitAnimation) {
    throw new Error("expected route fit implementation in generated map HTML");
  }

  assert.equal(fitAnimation.match(/map\.setFitView/g)?.length, 1);
  assert.equal(/requestAnimationFrame/.test(fitAnimation), false);
});

test("route stop markers use an integrated active name capsule", () => {
  process.env.EXPO_PUBLIC_AMAP_JS_API_KEY = "test-key";

  const html = buildAmapJsMapHtml(
    buildPayload({
      markers: [
        {
          activeLabel: "香格里拉虎跳峡景区",
          activeLabelDesktopMaxLength: 10,
          activeLabelMobileMaxLength: 8,
          appearance: "routeStop",
          coordinate: { latitude: 27.2, longitude: 100.1 },
          id: "stop-1",
          label: "1",
        },
      ],
    }),
    { securityCode: "test-security-code" },
  );

  assert.match(html, /marker-route-stop/);
  assert.match(html, /marker-sequence/);
  assert.match(html, /marker-name/);
  assert.match(html, /marker:not\(\.marker-route-stop\)\.marker-active/);
  assert.match(html, /activeLabelMobileMaxLength/);
  assert.match(
    html,
    /\.marker-route-stop \.marker-name \{[\s\S]*?max-width: 0/,
  );
  assert.match(
    html,
    /\.marker-route-stop\.marker-active \.marker-name \{[\s\S]*?max-width: 10em/,
  );

  const inlineScripts = Array.from(
    html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
    (match) => match[1]?.trim(),
  ).filter((script): script is string => Boolean(script));
  if (inlineScripts.length === 0) {
    throw new Error("expected generated map html to include inline scripts");
  }
  for (const inlineScript of inlineScripts) {
    new Function(inlineScript);
  }
});

test("estimated routes keep dashed rendering options in the map payload", () => {
  process.env.EXPO_PUBLIC_AMAP_JS_API_KEY = "test-key";

  const html = buildAmapJsMapHtml(
    buildPayload({
      polylines: [
        {
          color: "#2563EB",
          coordinates: [
            { latitude: 25.0453, longitude: 102.7097 },
            { latitude: 25.051, longitude: 102.716 },
          ],
          dashArray: [10, 8],
          id: "estimated-route",
          opacity: 0.5,
          strokeStyle: "dashed",
          width: 5,
        },
      ],
    }),
    { securityCode: "test-security-code" },
  );
  const payload = getInlinePayload(html);

  assert.deepEqual(payload.polylines, [
    {
      color: "#2563EB",
      coordinates: [
        { latitude: 25.0453, longitude: 102.7097 },
        { latitude: 25.051, longitude: 102.716 },
      ],
      dashArray: [10, 8],
      id: "estimated-route",
      opacity: 0.5,
      strokeStyle: "dashed",
      width: 5,
    },
  ]);
  assert.match(html, /polylineOptions\.strokeStyle = polyline\.strokeStyle/);
  assert.match(html, /polylineOptions\.strokeDasharray = polyline\.dashArray/);
});
