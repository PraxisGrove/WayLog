import assert from "node:assert/strict";
import test from "node:test";

import {
  getProfileAvatarObjectPath,
  isManagedProfileAvatarUrl,
  isUploadableProfileAvatarSource,
} from "../../../features/auth/avatar-storage";

test("getProfileAvatarObjectPath keeps avatars in the user folder", () => {
  assert.equal(getProfileAvatarObjectPath("user-123"), "user-123/avatar.jpg");
});

test("isUploadableProfileAvatarSource accepts local and inline sources", () => {
  assert.equal(isUploadableProfileAvatarSource("file:///avatar.jpg"), true);
  assert.equal(isUploadableProfileAvatarSource("content://media/avatar"), true);
  assert.equal(
    isUploadableProfileAvatarSource("blob:http://localhost/avatar"),
    true,
  );
  assert.equal(
    isUploadableProfileAvatarSource("data:image/jpeg;base64,abc"),
    true,
  );
  assert.equal(
    isUploadableProfileAvatarSource("https://example.com/avatar.jpg"),
    false,
  );
});

test("isManagedProfileAvatarUrl only recognizes the avatars public endpoint", () => {
  assert.equal(
    isManagedProfileAvatarUrl(
      "https://example.supabase.co/storage/v1/object/public/avatars/user-123/avatar.jpg?v=2",
    ),
    true,
  );
  assert.equal(
    isManagedProfileAvatarUrl("https://example.com/avatar.jpg"),
    false,
  );
});
