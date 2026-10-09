import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useMemo, useRef, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  avatarCropZoomRange,
  type CurrentAuthUser,
  getAvatarCoverLayout,
  getAvatarCropRect,
  getAvatarCropZoomFromTrackPosition,
  getClampedAvatarCropTransform,
  normalizeProfileAvatarImageUri,
  profileAvatarOffsetRange,
  profileAvatarScaleRange,
} from "@/features/auth";
import { createDiagnosticLogger } from "@/features/diagnostics";
import { avatarCropSize } from "../styles/profile-screen.styles";
import type { PendingAvatarCrop } from "../types";

const profileAvatarCropLogger = createDiagnosticLogger("profile-avatar-crop");
type UseProfileAvatarCropControllerParams = {
  authUser: CurrentAuthUser | null;
  setStatusMessage: (message: string) => void;
};

export function useProfileAvatarCropController({
  authUser,
  setStatusMessage,
}: UseProfileAvatarCropControllerParams) {
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarOffsetX, setAvatarOffsetX] = useState<number>(
    profileAvatarOffsetRange.defaultValue,
  );
  const [avatarOffsetY, setAvatarOffsetY] = useState<number>(
    profileAvatarOffsetRange.defaultValue,
  );
  const [avatarScale, setAvatarScale] = useState<number>(
    profileAvatarScaleRange.defaultValue,
  );
  const [pendingAvatarCrop, setPendingAvatarCrop] =
    useState<PendingAvatarCrop | null>(null);
  const [isCroppingAvatar, setCroppingAvatar] = useState(false);
  const [avatarCropZoomTrackWidth, setAvatarCropZoomTrackWidth] = useState(0);
  const pendingAvatarCropRef = useRef<PendingAvatarCrop | null>(null);
  const avatarCropDragStartRef = useRef({ offsetX: 0, offsetY: 0 });
  const avatarCropPinchStartRef = useRef({ distance: 0, zoom: 1 });
  pendingAvatarCropRef.current = pendingAvatarCrop;

  const avatarImageUri = normalizeProfileAvatarImageUri(avatarUrl);
  const hasUploadedAvatar = Boolean(avatarImageUri);
  const avatarImageTransform = useMemo(
    () => ({
      transform: [
        { translateX: avatarOffsetX },
        { translateY: avatarOffsetY },
        { scale: avatarScale },
      ],
    }),
    [avatarOffsetX, avatarOffsetY, avatarScale],
  );
  const pendingAvatarTransform = pendingAvatarCrop
    ? getClampedAvatarCropTransform({
        cropSize: avatarCropSize,
        imageHeight: pendingAvatarCrop.imageHeight,
        imageWidth: pendingAvatarCrop.imageWidth,
        offsetX: pendingAvatarCrop.offsetX,
        offsetY: pendingAvatarCrop.offsetY,
        zoom: pendingAvatarCrop.zoom,
      })
    : null;
  const pendingAvatarDisplay = pendingAvatarCrop
    ? {
        height: pendingAvatarCrop.displayHeight,
        width: pendingAvatarCrop.displayWidth,
      }
    : null;
  const pendingAvatarZoomProgress = pendingAvatarCrop
    ? (pendingAvatarCrop.zoom - avatarCropZoomRange.min) /
      (avatarCropZoomRange.max - avatarCropZoomRange.min)
    : 0;

  const syncAvatarDraft = useCallback(
    (nextAuthUser: CurrentAuthUser | null) => {
      setAvatarUrl(
        normalizeProfileAvatarImageUri(nextAuthUser?.user.avatarUrl),
      );
      setAvatarOffsetX(
        nextAuthUser?.user.avatarOffsetX ??
          profileAvatarOffsetRange.defaultValue,
      );
      setAvatarOffsetY(
        nextAuthUser?.user.avatarOffsetY ??
          profileAvatarOffsetRange.defaultValue,
      );
      setAvatarScale(
        nextAuthUser?.user.avatarScale ?? profileAvatarScaleRange.defaultValue,
      );
    },
    [],
  );

  const handleRemoveProfileAvatar = useCallback(() => {
    setAvatarUrl("");
    setAvatarOffsetX(profileAvatarOffsetRange.defaultValue);
    setAvatarOffsetY(profileAvatarOffsetRange.defaultValue);
    setAvatarScale(profileAvatarScaleRange.defaultValue);
  }, []);

  const handlePickAvatar = useCallback(async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setStatusMessage("需要允许访问相册后才能上传头像");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.92,
        shape: "oval",
      });

      const selectedAsset = result.assets?.[0];

      if (result.canceled || !selectedAsset?.uri) {
        return;
      }

      const sourceUri = normalizeProfileAvatarImageUri(selectedAsset.uri);

      if (!sourceUri || !selectedAsset.width || !selectedAsset.height) {
        setStatusMessage("头像文件读取失败，请换一张图片再试");
        return;
      }

      const layout = getAvatarCoverLayout({
        cropSize: avatarCropSize,
        imageHeight: selectedAsset.height,
        imageWidth: selectedAsset.width,
      });

      setPendingAvatarCrop({
        displayHeight: layout.displayHeight,
        displayWidth: layout.displayWidth,
        imageHeight: selectedAsset.height,
        imageWidth: selectedAsset.width,
        offsetX: 0,
        offsetY: 0,
        sourceUri,
        zoom: 1,
      });
      setStatusMessage("调整头像裁剪区域后点确认");
    } catch (error) {
      profileAvatarCropLogger.warn(
        "legacy.warn",
        { args: ["Failed to pick avatar image.", error] },
        "Legacy warning captured",
      );
      setStatusMessage("头像选择失败，请稍后再试");
    }
  }, [setStatusMessage]);

  const updatePendingAvatarCrop = useCallback(
    (
      patch: Partial<Pick<PendingAvatarCrop, "offsetX" | "offsetY" | "zoom">>,
    ) => {
      setPendingAvatarCrop((currentCrop) => {
        if (!currentCrop) {
          return currentCrop;
        }

        const transform = getClampedAvatarCropTransform({
          cropSize: avatarCropSize,
          imageHeight: currentCrop.imageHeight,
          imageWidth: currentCrop.imageWidth,
          offsetX: patch.offsetX ?? currentCrop.offsetX,
          offsetY: patch.offsetY ?? currentCrop.offsetY,
          zoom: patch.zoom ?? currentCrop.zoom,
        });

        return {
          ...currentCrop,
          offsetX: transform.offsetX,
          offsetY: transform.offsetY,
          zoom: transform.zoom,
        };
      });
    },
    [],
  );

  const handleAvatarCropZoomStep = useCallback(
    (direction: "decrease" | "increase") => {
      if (!pendingAvatarCrop) {
        return;
      }

      updatePendingAvatarCrop({
        zoom: pendingAvatarCrop.zoom + (direction === "increase" ? 0.1 : -0.1),
      });
    },
    [pendingAvatarCrop, updatePendingAvatarCrop],
  );

  const handleAvatarCropZoomTrack = useCallback(
    (positionX: number) => {
      if (!avatarCropZoomTrackWidth) {
        return;
      }

      updatePendingAvatarCrop({
        zoom: getAvatarCropZoomFromTrackPosition(
          positionX,
          avatarCropZoomTrackWidth,
        ),
      });
    },
    [avatarCropZoomTrackWidth, updatePendingAvatarCrop],
  );

  const handleResetAvatarCrop = useCallback(() => {
    updatePendingAvatarCrop({
      offsetX: 0,
      offsetY: 0,
      zoom: avatarCropZoomRange.min,
    });
  }, [updatePendingAvatarCrop]);

  const handleRotateAvatarCrop = useCallback(async () => {
    if (!pendingAvatarCrop || isCroppingAvatar) {
      return;
    }

    const currentCrop = pendingAvatarCrop;
    setCroppingAvatar(true);

    try {
      const rotatedImage = await manipulateAsync(
        currentCrop.sourceUri,
        [{ rotate: 90 }],
        {
          compress: 0.95,
          format: SaveFormat.JPEG,
        },
      );
      const imageWidth = rotatedImage.width || currentCrop.imageHeight;
      const imageHeight = rotatedImage.height || currentCrop.imageWidth;
      const layout = getAvatarCoverLayout({
        cropSize: avatarCropSize,
        imageHeight,
        imageWidth,
      });

      setPendingAvatarCrop({
        displayHeight: layout.displayHeight,
        displayWidth: layout.displayWidth,
        imageHeight,
        imageWidth,
        offsetX: 0,
        offsetY: 0,
        sourceUri: normalizeProfileAvatarImageUri(rotatedImage.uri),
        zoom: avatarCropZoomRange.min,
      });
    } catch (error) {
      profileAvatarCropLogger.warn(
        "legacy.warn",
        { args: ["Failed to rotate avatar image.", error] },
        "Legacy warning captured",
      );
      setStatusMessage("头像旋转失败，请重新选择图片");
    } finally {
      setCroppingAvatar(false);
    }
  }, [isCroppingAvatar, pendingAvatarCrop, setStatusMessage]);

  const handleConfirmAvatarCrop = useCallback(async () => {
    if (!pendingAvatarCrop) {
      return;
    }

    setCroppingAvatar(true);

    try {
      const crop = getAvatarCropRect({
        cropSize: avatarCropSize,
        imageHeight: pendingAvatarCrop.imageHeight,
        imageWidth: pendingAvatarCrop.imageWidth,
        offsetX: pendingAvatarCrop.offsetX,
        offsetY: pendingAvatarCrop.offsetY,
        zoom: pendingAvatarCrop.zoom,
      });
      const croppedImage = await manipulateAsync(
        pendingAvatarCrop.sourceUri,
        [
          { crop },
          {
            resize: {
              height: 512,
              width: 512,
            },
          },
        ],
        {
          base64: !authUser?.session.accessToken,
          compress: 0.86,
          format: SaveFormat.JPEG,
        },
      );

      setAvatarUrl(
        croppedImage.base64
          ? `data:image/jpeg;base64,${croppedImage.base64}`
          : normalizeProfileAvatarImageUri(croppedImage.uri),
      );
      setAvatarOffsetX(profileAvatarOffsetRange.defaultValue);
      setAvatarOffsetY(profileAvatarOffsetRange.defaultValue);
      setAvatarScale(profileAvatarScaleRange.defaultValue);
      setPendingAvatarCrop(null);
      setStatusMessage("头像已裁剪，保存资料后生效");
    } catch (error) {
      profileAvatarCropLogger.warn(
        "legacy.warn",
        { args: ["Failed to crop avatar image.", error] },
        "Legacy warning captured",
      );
      setStatusMessage("头像裁剪失败，请换一张图片再试");
    } finally {
      setCroppingAvatar(false);
    }
  }, [authUser?.session.accessToken, pendingAvatarCrop, setStatusMessage]);

  const hasPendingAvatarCrop = Boolean(pendingAvatarCrop);
  const avatarCropGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .enabled(hasPendingAvatarCrop && !isCroppingAvatar)
      .runOnJS(true)
      .onBegin(() => {
        const currentCrop = pendingAvatarCropRef.current;

        if (!currentCrop) {
          return;
        }

        avatarCropDragStartRef.current = {
          offsetX: currentCrop.offsetX,
          offsetY: currentCrop.offsetY,
        };
      })
      .onUpdate((event) => {
        if (!pendingAvatarCropRef.current) {
          return;
        }

        updatePendingAvatarCrop({
          offsetX: avatarCropDragStartRef.current.offsetX + event.translationX,
          offsetY: avatarCropDragStartRef.current.offsetY + event.translationY,
        });
      });

    const pinchGesture = Gesture.Pinch()
      .enabled(hasPendingAvatarCrop && !isCroppingAvatar)
      .runOnJS(true)
      .onBegin(() => {
        avatarCropPinchStartRef.current = {
          distance: 1,
          zoom: pendingAvatarCropRef.current?.zoom ?? 1,
        };
      })
      .onUpdate((event) => {
        if (!pendingAvatarCropRef.current) {
          return;
        }

        updatePendingAvatarCrop({
          zoom: avatarCropPinchStartRef.current.zoom * event.scale,
        });
      });

    return Gesture.Simultaneous(panGesture, pinchGesture);
  }, [hasPendingAvatarCrop, isCroppingAvatar, updatePendingAvatarCrop]);

  return {
    avatarCropGesture,
    avatarImageTransform,
    avatarImageUri,
    avatarOffsetX,
    avatarOffsetY,
    avatarScale,
    handleAvatarCropZoomStep,
    handleAvatarCropZoomTrack,
    handleConfirmAvatarCrop,
    handlePickAvatar,
    handleRemoveProfileAvatar,
    handleResetAvatarCrop,
    handleRotateAvatarCrop,
    hasUploadedAvatar,
    isCroppingAvatar,
    pendingAvatarCrop,
    pendingAvatarDisplay,
    pendingAvatarTransform,
    pendingAvatarZoomProgress,
    setAvatarCropZoomTrackWidth,
    setPendingAvatarCrop,
    syncAvatarDraft,
  };
}
