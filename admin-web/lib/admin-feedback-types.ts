export type AdminFeedbackStatus =
  | "ignored"
  | "in_progress"
  | "pending"
  | "resolved";

export type AdminFeedbackSeverity = "blocking" | "important" | "normal";

export type AdminFeedbackAuditLog = {
  action: string;
  actorUserId: string | null;
  createdAt: string;
  id: number;
  payload: unknown;
};

export type AdminFeedbackItem = {
  adminNote: string | null;
  appVersion: string | null;
  assignedTo: string | null;
  contactMethod: string | null;
  contactValue: string | null;
  createdAt: string;
  description: string;
  deviceInfo: unknown;
  diagnosticContext: string | null;
  handledAt: string | null;
  handledBy: string | null;
  id: string;
  platform: string | null;
  relatedAgentCallId: number | null;
  relatedPoiId: string | null;
  relatedTripId: string | null;
  replyMessage: string | null;
  resolvedAt: string | null;
  severity: AdminFeedbackSeverity;
  sourcePage: string | null;
  status: AdminFeedbackStatus;
  updatedAt: string | null;
  user: {
    displayName: string | null;
    email: string | null;
    id: string;
    phone: string | null;
  } | null;
  userId: string | null;
};

export type AdminFeedbackListData = {
  feedback: AdminFeedbackItem[];
  generatedAt: string;
  page: number;
  pageSize: number;
  query: string;
  severity: AdminFeedbackSeverity | "all";
  severityCounts: Record<AdminFeedbackSeverity, number>;
  status: AdminFeedbackStatus | "all";
  statusCounts: Record<AdminFeedbackStatus, number>;
  total: number;
  warnings: string[];
};

export type AdminFeedbackDetail = AdminFeedbackItem & {
  auditLogs: AdminFeedbackAuditLog[];
};

export type AdminFeedbackListOptions = {
  page?: number;
  pageSize?: number;
  query?: string;
  severity?: AdminFeedbackSeverity | "all";
  status?: AdminFeedbackStatus | "all";
};

export type AdminFeedbackUpdateInput = {
  adminNote?: string | null;
  assignedTo?: string | null;
  relatedAgentCallId?: number | null;
  relatedPoiId?: string | null;
  relatedTripId?: string | null;
  replyMessage?: string | null;
  severity?: AdminFeedbackSeverity;
  sourcePage?: string | null;
  status?: AdminFeedbackStatus;
};
