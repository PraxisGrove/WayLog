export type AvatarCropInput = {
  cropSize: number;
  imageHeight: number;
  imageWidth: number;
  offsetX: number;
  offsetY: number;
  zoom: number;
};

export type AvatarCropRect = {
  height: number;
  originX: number;
  originY: number;
  width: number;
};

export type AvatarCropTransform = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

export const avatarCropZoomRange = {
  max: 4,
  min: 1,
} as const;

export function getAvatarCropZoomFromTrackPosition(
  positionX: number,
  trackWidth: number,
): number {
  const safeTrackWidth = Math.max(1, trackWidth);
  const progress = Math.min(1, Math.max(0, positionX / safeTrackWidth));
  const zoom =
    avatarCropZoomRange.min +
    progress * (avatarCropZoomRange.max - avatarCropZoomRange.min);

  return Math.round(zoom * 100) / 100;
}

export function getAvatarCoverLayout(
  input: Pick<AvatarCropInput, "cropSize" | "imageHeight" | "imageWidth">,
) {
  const imageWidth = Math.max(1, input.imageWidth);
  const imageHeight = Math.max(1, input.imageHeight);
  const scale = input.cropSize / Math.min(imageWidth, imageHeight);

  return {
    displayHeight: Math.round(imageHeight * scale),
    displayWidth: Math.round(imageWidth * scale),
  };
}

export function getClampedAvatarCropTransform(
  input: AvatarCropInput,
): AvatarCropTransform {
  const layout = getAvatarCoverLayout(input);
  const zoom = Math.min(
    avatarCropZoomRange.max,
    Math.max(avatarCropZoomRange.min, input.zoom),
  );
  const scaledWidth = layout.displayWidth * zoom;
  const scaledHeight = layout.displayHeight * zoom;
  const maxOffsetX = Math.max(0, (scaledWidth - input.cropSize) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - input.cropSize) / 2);

  return {
    offsetX: Math.round(
      Math.min(maxOffsetX, Math.max(-maxOffsetX, input.offsetX)),
    ),
    offsetY: Math.round(
      Math.min(maxOffsetY, Math.max(-maxOffsetY, input.offsetY)),
    ),
    zoom: Math.round(zoom * 100) / 100,
  };
}

export function getAvatarCropRect(input: AvatarCropInput): AvatarCropRect {
  const transform = getClampedAvatarCropTransform(input);
  const layout = getAvatarCoverLayout(input);
  const imageWidth = Math.max(1, input.imageWidth);
  const imageHeight = Math.max(1, input.imageHeight);
  const displayedWidth = layout.displayWidth * transform.zoom;
  const displayedHeight = layout.displayHeight * transform.zoom;
  const imageLeft = (input.cropSize - displayedWidth) / 2 + transform.offsetX;
  const imageTop = (input.cropSize - displayedHeight) / 2 + transform.offsetY;
  const widthRatio = imageWidth / displayedWidth;
  const heightRatio = imageHeight / displayedHeight;
  const width = Math.min(imageWidth, Math.round(input.cropSize * widthRatio));
  const height = Math.min(
    imageHeight,
    Math.round(input.cropSize * heightRatio),
  );
  const originX = Math.min(
    imageWidth - width,
    Math.max(0, Math.round(-imageLeft * widthRatio)),
  );
  const originY = Math.min(
    imageHeight - height,
    Math.max(0, Math.round(-imageTop * heightRatio)),
  );

  return {
    height,
    originX,
    originY,
    width,
  };
}
