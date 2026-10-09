export type AdminPoiReviewStatus =
  | "confirmed"
  | "ignored"
  | "merged"
  | "needs_fix"
  | "pending";

export type AdminPoiAuditLog = {
  action: string;
  actorUserId: string | null;
  createdAt: string;
  id: number;
  payload: unknown;
};

export type AdminPoiItem = {
  address: string | null;
  amapPoiId: string;
  area: string | null;
  category: string | null;
  createdAt: string | null;
  dataSource: string | null;
  details: unknown;
  externalRefs: unknown;
  iconKey: string | null;
  latitude: number | null;
  longitude: number | null;
  mergedIntoAmapPoiId: string | null;
  name: string;
  photos: unknown;
  poiGroup: string | null;
  poiType: string | null;
  rawSummary: string | null;
  reviewNote: string | null;
  reviewStatus: AdminPoiReviewStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  sourceNote: string | null;
  updatedAt: string | null;
  version: number | null;
};

export type AdminPoiListData = {
  category: string;
  generatedAt: string;
  page: number;
  pageSize: number;
  pois: AdminPoiItem[];
  query: string;
  reviewStatus: AdminPoiReviewStatus | "all";
  statusCounts: Record<AdminPoiReviewStatus, number>;
  total: number;
  warnings: string[];
};

export type AdminPoiDetail = AdminPoiItem & {
  auditLogs: AdminPoiAuditLog[];
};

export type AdminPoiListOptions = {
  category?: string;
  page?: number;
  pageSize?: number;
  query?: string;
  reviewStatus?: AdminPoiReviewStatus | "all";
};

export type AdminPoiUpdateInput = {
  address?: string | null;
  area?: string | null;
  category?: string | null;
  dataSource?: string | null;
  details?: unknown;
  externalRefs?: unknown;
  iconKey?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  name?: string;
  photos?: unknown;
  poiGroup?: string | null;
  poiType?: string | null;
  rawSummary?: string | null;
  reviewNote?: string | null;
  reviewStatus?: AdminPoiReviewStatus;
  sourceNote?: string | null;
};

export type AdminPoiCreateInput = AdminPoiUpdateInput & {
  amapPoiId: string;
  name: string;
};

export type AdminPoiDeleteResult = {
  amapPoiId: string;
  hardDeleted: boolean;
  reviewStatus?: AdminPoiReviewStatus;
};

export type AdminPoiMergeInput = {
  note?: string | null;
  targetAmapPoiId: string;
};
