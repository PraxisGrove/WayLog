import type { CurrentAuthUser } from "@/features/auth";

export type PendingAvatarCrop = {
  displayHeight: number;
  displayWidth: number;
  imageHeight: number;
  imageWidth: number;
  offsetX: number;
  offsetY: number;
  sourceUri: string;
  zoom: number;
};

export type LoginMethod = "code" | "password";

export type LoginMascotFocus = "account" | "code" | "password" | null;

export type PendingGuestMigration = {
  nextAuthUser: CurrentAuthUser;
  successMessage: string;
};
