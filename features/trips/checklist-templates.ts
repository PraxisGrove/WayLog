import { defaultTripChecklistTitles } from "./checklist";
import type { CloudSyncSession } from "./cloud-sync";
import {
  fetchCloudPreferenceRow,
  upsertCloudPreferenceRow,
} from "./cloud-sync";
import type { TripChecklistItem } from "./types";
import {
  createPreferenceSync,
  type PreferenceCloudAdapter,
  type PreferenceStorageAdapter,
} from "./unified-preferences";

export const TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY =
  "waylog.preferences.checklist_templates.v1";

export type TripChecklistTemplateSource = "system" | "user";

export type TripChecklistTemplate = {
  description?: string;
  id: string;
  name: string;
  source: TripChecklistTemplateSource;
  titles: string[];
  updatedAt?: string;
};

export type TripChecklistTemplatePreference = {
  selectedTemplateId: string;
  userTemplates: TripChecklistTemplate[];
};

export const systemTripChecklistTemplates: TripChecklistTemplate[] = [
  {
    description: "适合大多数短途和城市旅行",
    id: "system-basic",
    name: "基础出行",
    source: "system",
    titles: defaultTripChecklistTitles,
  },
  {
    description: "减少行李体积，只保留最常用物品",
    id: "system-light",
    name: "轻装短途",
    source: "system",
    titles: ["身份证", "手机", "充电器", "换洗衣物", "常用药"],
  },
  {
    description: "覆盖证件、护理、备用衣物等家庭出行物品",
    id: "system-family",
    name: "家庭亲子",
    source: "system",
    titles: [
      "身份证/护照",
      "儿童证件",
      "常用药",
      "纸巾湿巾",
      "备用衣物",
      "充电设备",
      "雨具",
    ],
  },
  {
    description: "适合差旅场景的证件、办公和报销准备",
    id: "system-business",
    name: "商务差旅",
    source: "system",
    titles: [
      "身份证",
      "电脑",
      "充电器",
      "移动电源",
      "会议资料",
      "发票抬头",
      "正装",
    ],
  },
];

export const defaultTripChecklistTemplatePreference: TripChecklistTemplatePreference =
  {
    selectedTemplateId: "system-basic",
    userTemplates: [],
  };

type CreateUserChecklistTemplateDeps = {
  idGen?: () => string;
  now?: () => string;
};

type CreateUserChecklistTemplateInput = {
  description?: string;
  id?: string;
  name: string;
  titles: string[];
};

const systemTemplateIds = new Set(
  systemTripChecklistTemplates.map((template) => template.id),
);

function normalizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue.slice(0, maxLength) : undefined;
}

function normalizeTemplateTitles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const titles: string[] = [];
  const seenTitles = new Set<string>();

  value.forEach((item) => {
    const title = normalizeText(item, 40);

    if (!title || seenTitles.has(title)) {
      return;
    }

    seenTitles.add(title);
    titles.push(title);
  });

  return titles.slice(0, 50);
}

function createFallbackUserTemplateId(index: number): string {
  return `user-template-${index + 1}`;
}

function normalizeTemplateId(value: unknown, fallbackId: string): string {
  const id = normalizeText(value, 80);
  return id ?? fallbackId;
}

function normalizeUserTemplates(value: unknown): TripChecklistTemplate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const usedIds = new Set(systemTemplateIds);
  const templates: TripChecklistTemplate[] = [];

  value.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      return;
    }

    const source = item as Record<string, unknown>;
    const name = normalizeText(source.name, 30);
    const titles = normalizeTemplateTitles(source.titles);

    if (!name || titles.length === 0) {
      return;
    }

    const fallbackId = createFallbackUserTemplateId(index);
    let id = normalizeTemplateId(source.id, fallbackId);

    if (usedIds.has(id)) {
      id = fallbackId;
    }

    let suffix = 2;
    const originalId = id;
    while (usedIds.has(id)) {
      id = `${originalId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(id);
    templates.push({
      description: normalizeText(source.description, 80),
      id,
      name,
      source: "user",
      titles,
      updatedAt: normalizeText(source.updatedAt, 40),
    });
  });

  return templates.slice(0, 20);
}

export function normalizeTripChecklistTemplatePreference(
  value: unknown,
): TripChecklistTemplatePreference {
  if (typeof value !== "object" || value === null) {
    return defaultTripChecklistTemplatePreference;
  }

  const source = value as Record<string, unknown>;
  const userTemplates = normalizeUserTemplates(source.userTemplates);
  const availableTemplateIds = new Set([
    ...systemTripChecklistTemplates.map((template) => template.id),
    ...userTemplates.map((template) => template.id),
  ]);
  const selectedTemplateId = normalizeText(source.selectedTemplateId, 80);

  return {
    selectedTemplateId:
      selectedTemplateId && availableTemplateIds.has(selectedTemplateId)
        ? selectedTemplateId
        : defaultTripChecklistTemplatePreference.selectedTemplateId,
    userTemplates,
  };
}

const checklistTemplatePreferenceSync =
  createPreferenceSync<TripChecklistTemplatePreference>({
    storageKey: TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY,
    defaultValue: defaultTripChecklistTemplatePreference,
    normalize: normalizeTripChecklistTemplatePreference,
    fetchCloudRow: (session: CloudSyncSession) =>
      fetchCloudPreferenceRow(session, "checklist_templates"),
    upsertCloudRow: (
      session: CloudSyncSession,
      preference: TripChecklistTemplatePreference,
    ) => upsertCloudPreferenceRow(session, "checklist_templates", preference),
  });

export function setTripChecklistTemplatePreferenceStorageAdapterForTests(
  adapter: PreferenceStorageAdapter | null,
): void {
  checklistTemplatePreferenceSync.setStorageAdapterForTests(adapter);
}

export function setTripChecklistTemplatePreferenceCloudAdapterForTests(
  adapter: PreferenceCloudAdapter | null,
): void {
  checklistTemplatePreferenceSync.setCloudAdapterForTests(adapter);
}

export async function clearLocalTripChecklistTemplatePreference(): Promise<void> {
  await checklistTemplatePreferenceSync.clear();
}

export async function hasLocalGuestTripChecklistTemplatePreferenceData(): Promise<boolean> {
  return checklistTemplatePreferenceSync.hasGuestData();
}

export async function syncTripChecklistTemplatePreferenceWithCloud(): Promise<TripChecklistTemplatePreference> {
  return checklistTemplatePreferenceSync.sync();
}

export async function getTripChecklistTemplatePreference(): Promise<TripChecklistTemplatePreference> {
  return checklistTemplatePreferenceSync.get();
}

export async function saveTripChecklistTemplatePreference(
  preference: TripChecklistTemplatePreference,
): Promise<void> {
  await checklistTemplatePreferenceSync.save(preference);
}

export function getAllTripChecklistTemplates(
  preference: TripChecklistTemplatePreference,
): TripChecklistTemplate[] {
  const normalizedPreference =
    normalizeTripChecklistTemplatePreference(preference);
  return [
    ...systemTripChecklistTemplates,
    ...normalizedPreference.userTemplates,
  ];
}

export function getSelectedTripChecklistTemplate(
  preference: TripChecklistTemplatePreference,
): TripChecklistTemplate {
  const templates = getAllTripChecklistTemplates(preference);
  return (
    templates.find(
      (template) => template.id === preference.selectedTemplateId,
    ) ?? systemTripChecklistTemplates[0]
  );
}

function sanitizeChecklistItemIdPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "template"
  );
}

export function createTripChecklistItemsFromTemplate(
  template: TripChecklistTemplate,
): TripChecklistItem[] {
  return normalizeTemplateTitles(template.titles).map((title, index) => ({
    id: `checklist-${sanitizeChecklistItemIdPart(template.id)}-${index + 1}`,
    isCompleted: false,
    title,
  }));
}

export function parseChecklistTemplateItemsText(value: string): string[] {
  return normalizeTemplateTitles(value.split(/\r?\n|[、,，]/));
}

export function createUserTripChecklistTemplate(
  input: CreateUserChecklistTemplateInput,
  deps: CreateUserChecklistTemplateDeps = {},
): TripChecklistTemplate | null {
  const name = normalizeText(input.name, 30);
  const titles = normalizeTemplateTitles(input.titles);

  if (!name || titles.length === 0) {
    return null;
  }

  const now = deps.now?.() ?? new Date().toISOString();
  const id =
    input.id ?? deps.idGen?.() ?? `user-template-${Date.now().toString(36)}`;

  return {
    description: normalizeText(input.description, 80),
    id,
    name,
    source: "user",
    titles,
    updatedAt: now,
  };
}
