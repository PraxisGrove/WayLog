export type AdminModuleKey =
  | "agent"
  | "dashboard"
  | "diagnostics"
  | "feedback"
  | "members"
  | "poi"
  | "serviceConfigs"
  | "users";

export type AdminModule = {
  description: string;
  href: string;
  key: AdminModuleKey;
  label: string;
  stage: string;
};

export type ResourceModuleKey = Exclude<AdminModuleKey, "dashboard">;

export type ResourceModule = AdminModule & {
  key: ResourceModuleKey;
};

export const adminModules: AdminModule[] = [
  {
    description: "管理员权限状态、模块健康度和关键运营入口。",
    href: "/",
    key: "dashboard",
    label: "总览",
    stage: "已接入",
  },
  {
    description: "搜索用户，查看账号、资料、行程同步状态和诊断上下文。",
    href: "/users",
    key: "users",
    label: "用户",
    stage: "已接入",
  },
  {
    description: "管理 Auth 用户在后台的角色、启停状态和权限审计。",
    href: "/members",
    key: "members",
    label: "权限账户",
    stage: "MVP",
  },
  {
    description: "编辑、审查和合并 POI 缓存，处理地点数据质量问题。",
    href: "/poi",
    key: "poi",
    label: "POI 审查",
    stage: "已接入",
  },
  {
    description:
      "管理 LLM、地图、POI、通知和监控 provider，支持密钥轮换、测试连接和审计。",
    href: "/service-configs",
    key: "serviceConfigs",
    label: "服务配置",
    stage: "MVP",
  },
  {
    description: "查看 Agent 调用量、失败原因、限流和后续成本统计。",
    href: "/agent",
    key: "agent",
    label: "Agent 日志",
    stage: "下一阶段",
  },
  {
    description: "处理用户反馈、内部备注、状态流转和后续消息回复。",
    href: "/feedback",
    key: "feedback",
    label: "反馈",
    stage: "已接入",
  },
  {
    description: "查看崩溃报告、同步错误和发布排障信息。",
    href: "/diagnostics",
    key: "diagnostics",
    label: "排障",
    stage: "下一阶段",
  },
];

export const resourceModules = adminModules.filter(
  (module): module is ResourceModule => module.key !== "dashboard",
);
