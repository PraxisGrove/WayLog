/**
 * Supabase Storage avatar helpers.
 *
 * The database stores only a public URL. The cropped image bytes live in the
 * `avatars` bucket at a deterministic per-user path.
 */

import { getSupabaseConfig } from "./supabase";

const PROFILE_AVATAR_BUCKET = "avatars";
const PROFILE_AVATAR_FILE_NAME = "avatar.jpg";
const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

type UploadProfileAvatarInput = {
  accessToken: string;
  sourceUri: string;
  userId: string;
};

function encodeObjectPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function readStorageError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };

  return (
    payload.message ??
    payload.error ??
    `头像存储请求失败（HTTP ${response.status}）`
  );
}

async function createAvatarBlob(sourceUri: string): Promise<Blob> {
  const response = await fetch(sourceUri);

  if (!response.ok) {
    throw new Error("无法读取裁剪后的头像文件");
  }

  const blob = await response.blob();

  if (!blob.size) {
    throw new Error("头像文件为空，请重新选择图片");
  }

  if (blob.size > PROFILE_AVATAR_MAX_BYTES) {
    throw new Error("头像文件不能超过 2 MB");
  }

  return blob;
}

export function getProfileAvatarObjectPath(userId: string): string {
  return `${userId}/${PROFILE_AVATAR_FILE_NAME}`;
}

export function isUploadableProfileAvatarSource(
  sourceUri?: string | null,
): boolean {
  return /^(blob|content|data|file):/i.test(sourceUri?.trim() ?? "");
}

export function isManagedProfileAvatarUrl(sourceUri?: string | null): boolean {
  const value = sourceUri?.trim() ?? "";
  return value.includes(`/storage/v1/object/public/${PROFILE_AVATAR_BUCKET}/`);
}

export async function uploadProfileAvatar(
  input: UploadProfileAvatarInput,
): Promise<string> {
  const config = getSupabaseConfig();
  const objectPath = getProfileAvatarObjectPath(input.userId);
  const encodedObjectPath = encodeObjectPath(objectPath);
  const blob = await createAvatarBlob(input.sourceUri);
  const response = await fetch(
    `${config.url}/storage/v1/object/${PROFILE_AVATAR_BUCKET}/${encodedObjectPath}`,
    {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${input.accessToken}`,
        "Cache-Control": "3600",
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
      body: blob,
    },
  );

  if (!response.ok) {
    throw new Error(await readStorageError(response));
  }

  return `${config.url}/storage/v1/object/public/${PROFILE_AVATAR_BUCKET}/${encodedObjectPath}?v=${Date.now()}`;
}

export async function removeProfileAvatar(input: {
  accessToken: string;
  userId: string;
}): Promise<void> {
  const config = getSupabaseConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${PROFILE_AVATAR_BUCKET}`,
    {
      method: "DELETE",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefixes: [getProfileAvatarObjectPath(input.userId)],
      }),
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(await readStorageError(response));
  }
}
