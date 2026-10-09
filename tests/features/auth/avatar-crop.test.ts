import assert from "node:assert/strict";
import test from "node:test";

import {
  avatarCropZoomRange,
  getAvatarCoverLayout,
  getAvatarCropRect,
  getAvatarCropZoomFromTrackPosition,
  getClampedAvatarCropTransform,
} from "../../../features/auth/avatar-crop";

test("avatar crop covers a landscape image and crops the centered square", () => {
  const rect = getAvatarCropRect({
    cropSize: 280,
    imageHeight: 2000,
    imageWidth: 4000,
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  });

  assert.deepEqual(rect, {
    height: 2000,
    originX: 1000,
    originY: 0,
    width: 2000,
  });
});

test("avatar crop zooms into the center of a square image", () => {
  const rect = getAvatarCropRect({
    cropSize: 280,
    imageHeight: 1000,
    imageWidth: 1000,
    offsetX: 0,
    offsetY: 0,
    zoom: 2,
  });

  assert.deepEqual(rect, {
    height: 500,
    originX: 250,
    originY: 250,
    width: 500,
  });
});

test("avatar crop clamps offsets so the crop window stays covered", () => {
  const transform = getClampedAvatarCropTransform({
    cropSize: 280,
    imageHeight: 2000,
    imageWidth: 4000,
    offsetX: 999,
    offsetY: 999,
    zoom: 1,
  });

  assert.deepEqual(transform, {
    offsetX: 140,
    offsetY: 0,
    zoom: 1,
  });
});

test("avatar cover layout keeps portrait images filling the crop square", () => {
  const layout = getAvatarCoverLayout({
    cropSize: 280,
    imageHeight: 4000,
    imageWidth: 2000,
  });

  assert.deepEqual(layout, {
    displayHeight: 560,
    displayWidth: 280,
  });
});

test("avatar zoom slider maps and clamps positions to the supported zoom range", () => {
  assert.equal(
    getAvatarCropZoomFromTrackPosition(0, 300),
    avatarCropZoomRange.min,
  );
  assert.equal(getAvatarCropZoomFromTrackPosition(150, 300), 2.5);
  assert.equal(
    getAvatarCropZoomFromTrackPosition(400, 300),
    avatarCropZoomRange.max,
  );
  assert.equal(
    getAvatarCropZoomFromTrackPosition(-20, 300),
    avatarCropZoomRange.min,
  );
});
