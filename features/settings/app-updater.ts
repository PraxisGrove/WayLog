import {
  cacheDirectory,
  createDownloadResumable,
  deleteAsync,
  getContentUriAsync,
  getInfoAsync,
} from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

export type UpdaterStatus =
  | "idle"
  | "downloading"
  | "installing"
  | "error"
  | "done";

export type UpdaterState = {
  errorMessage?: string;
  progress: number;
  status: UpdaterStatus;
  visible: boolean;
};

const APK_FILENAME = "waylog-update.apk";

function getApkCachePath(): string {
  return `${cacheDirectory}${APK_FILENAME}`;
}

export function isNativeInstallSupported(): boolean {
  return Platform.OS === "android";
}

export async function downloadApk(
  downloadUrl: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const targetPath = getApkCachePath();

  const fileInfo = await getInfoAsync(targetPath);

  if (fileInfo.exists) {
    await deleteAsync(targetPath, { idempotent: true });
  }

  const downloadResumable = createDownloadResumable(
    downloadUrl,
    targetPath,
    {},
    (downloadProgress) => {
      const progress = Math.round(
        (downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite) *
          100,
      );
      onProgress?.(progress);
    },
  );

  const result = await downloadResumable.downloadAsync();

  if (!result?.uri) {
    throw new Error("下载失败，请检查网络连接后重试。");
  }

  return result.uri;
}

export async function installApk(fileUri: string): Promise<void> {
  const contentUri = await getContentUriAsync(fileUri);

  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: "application/vnd.android.package-archive",
  });
}

export async function cleanupApkCache(): Promise<void> {
  try {
    const targetPath = getApkCachePath();
    const fileInfo = await getInfoAsync(targetPath);

    if (fileInfo.exists) {
      await deleteAsync(targetPath, { idempotent: true });
    }
  } catch {}
}
