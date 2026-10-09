#!/usr/bin/env node

const { readFileSync } = require("node:fs");

function readLocalEnv() {
  let content;
  try {
    content = readFileSync(".env.local", "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Map();
    }
    throw error;
  }

  const entries = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (value && value !== "?") {
      entries.set(line.slice(0, separatorIndex).trim(), value);
    }
  }
  return entries;
}

const localEnv = readLocalEnv();
const SUPABASE_URL = (
  process.env.SUPABASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  localEnv.get("SUPABASE_URL") ||
  localEnv.get("EXPO_PUBLIC_SUPABASE_URL") ||
  ""
).replace(/\/+$/, "");
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  localEnv.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  localEnv.get("EXPO_PUBLIC_SUPABASE_ANON_KEY");

function writeLine(...messages) {
  process.stdout.write(`${messages.join(" ")}\n`);
}

function writeErrorLine(...messages) {
  process.stderr.write(`${messages.join(" ")}\n`);
}

if (!SUPABASE_URL) {
  writeErrorLine(
    "缺少目标项目 URL：请配置 SUPABASE_URL 或 EXPO_PUBLIC_SUPABASE_URL。",
  );
  process.exit(1);
}

try {
  const parsedUrl = new URL(SUPABASE_URL);
  if (
    !["https:", "http:"].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("目标 URL 必须是自己 Supabase 项目的 HTTP(S) 根地址。");
  }
} catch {
  writeErrorLine("目标 Supabase URL 无效，请检查配置；未发出任何请求。");
  process.exit(1);
}

if (!SERVICE_KEY || !ANON_KEY) {
  writeErrorLine(
    "缺少环境变量: SUPABASE_SERVICE_ROLE_KEY 或 EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
  writeErrorLine("请在 .env.local 中配置");
  process.exit(1);
}

async function fetchIncompletePois() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/poi_cache?or=(name.is.null,name.eq.,latitude.is.null)&select=amap_poi_id,name,latitude,longitude,details,photos&order=amap_poi_id`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  return resp.json();
}

async function fetchAmapDetail(amapPoiId) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/amap-proxy`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: "/v5/place/detail",
      params: { id: amapPoiId, show_fields: "business,photos" },
    }),
  });

  const data = await resp.json();

  if (data.status !== "1" || !data.pois?.[0]) {
    return null;
  }

  const poi = data.pois[0];
  const location = poi.location?.split(",") || [];

  return {
    name: poi.name,
    address: poi.address,
    category: poi.type?.split(";")[0],
    latitude: parseFloat(location[1]) || null,
    longitude: parseFloat(location[0]) || null,
    details: {
      ...(poi.biz_ext?.rating && { rating: parseFloat(poi.biz_ext.rating) }),
      ...(poi.biz_ext?.cost && { priceLevel: poi.biz_ext.cost }),
      ...(poi.tel && { phone: poi.tel }),
      ...(poi.biz_ext?.open_time && { openingHours: poi.biz_ext.open_time }),
      ratingSource: "高德",
    },
    photos: (poi.photos || []).map((p, i) => ({
      id: `amap-photo-${amapPoiId}-${i}`,
      url: p.url,
      sourceLabel: "高德",
      ...(p.title && { credit: p.title }),
    })),
  };
}

async function updatePoiCache(amapPoiId, data) {
  const payload = {};

  if (data.name) payload.name = data.name;
  if (data.address) payload.address = data.address;
  if (data.category) payload.category = data.category;
  if (data.latitude) payload.latitude = data.latitude;
  if (data.longitude) payload.longitude = data.longitude;
  if (data.details && Object.keys(data.details).length > 0)
    payload.details = data.details;
  if (data.photos && data.photos.length > 0) payload.photos = data.photos;

  if (Object.keys(payload).length === 0) return false;

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/poi_cache?amap_poi_id=eq.${amapPoiId}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    },
  );

  return resp.ok;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  writeLine("=== poi_cache 数据修复工具 ===\n");

  const incomplete = await fetchIncompletePois();
  writeLine(`找到 ${incomplete.length} 条不完整记录\n`);

  if (incomplete.length === 0) {
    writeLine("所有数据都完整，无需修复。");
    return;
  }

  let fixed = 0;
  let failed = 0;

  for (const poi of incomplete) {
    const id = poi.amap_poi_id;
    const oldName = poi.name || "(空)";
    process.stdout.write(`[${id}] ${oldName} ... `);

    const detail = await fetchAmapDetail(id);

    if (!detail) {
      writeLine("❌ 高德未返回数据");
      failed++;
      await sleep(500);
      continue;
    }

    const ok = await updatePoiCache(id, detail);

    if (ok) {
      writeLine(`✅ → ${detail.name}`);
      fixed++;
    } else {
      writeLine("❌ 更新失败");
      failed++;
    }

    await sleep(300);
  }

  writeLine(`\n=== 完成 ===`);
  writeLine(
    `修复: ${fixed} 条 | 失败: ${failed} 条 | 跳过: ${incomplete.length - fixed - failed} 条`,
  );
}

main().catch((error) => {
  writeErrorLine(error instanceof Error ? error.message : error);
  process.exit(1);
});
