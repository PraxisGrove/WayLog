export type QuickActionRoute = "newTrip" | "importGuide" | "recordExpense";

export type TripQuickActionIcon = "flight-takeoff" | "library-add" | "payments";

export type TripQuickActionColorToken =
  | "primary"
  | "primarySoft"
  | "cyan"
  | "cyanSoft"
  | "success"
  | "successSoft"
  | "violet"
  | "violetSoft";

export type TripQuickAction = {
  title: string;
  detail: string;
  icon: TripQuickActionIcon;
  colorToken: TripQuickActionColorToken;
  backgroundColorToken: TripQuickActionColorToken;
  route?: QuickActionRoute;
};

export const quickActions: TripQuickAction[] = [
  {
    title: "新建行程",
    detail: "名称 / 每日安排",
    icon: "flight-takeoff",
    colorToken: "primary",
    backgroundColorToken: "primarySoft",
    route: "newTrip",
  },
  {
    title: "导入攻略",
    detail: "链接 / 文字 / 图片",
    icon: "library-add",
    colorToken: "cyan",
    backgroundColorToken: "cyanSoft",
    route: "importGuide",
  },
  {
    title: "记录花费",
    detail: "交通 / 住宿 / 餐饮",
    icon: "payments",
    colorToken: "violet",
    backgroundColorToken: "violetSoft",
    route: "recordExpense",
  },
];

export const primaryQuickAction = quickActions[0];

export const secondaryQuickActions = quickActions.slice(1);
