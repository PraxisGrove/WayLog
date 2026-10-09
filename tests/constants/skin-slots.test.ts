import assert from "node:assert/strict";
import test from "node:test";

import {
  getSkinSlotAdapter,
  getSkinSlotDefaultAdapterId,
  isSkinSlotId,
  normalizeSkinSlotOverrides,
  resolveSkinSlots,
  SKIN_FOUNDATION_LOCKED_PARTS,
  SKIN_SLOT_DEFINITIONS,
  skinSlotAdapterIds,
} from "../../shared/theme/skin-slot-registry";
import {
  SKIN_SLOT_IDS,
  type SkinSlotId,
} from "../../shared/theme/skin-slot-types";
import {
  getThemeDefinition,
  THEME_DEFINITIONS,
} from "../../shared/theme/theme-registry";

test("skin slot registry exposes stable mixable module ids", () => {
  assert.deepEqual(SKIN_SLOT_IDS, [
    "home.featuredTripCard",
    "home.tripListCard",
    "home.todayPlan",
    "shell.tabBar",
    "profile.profileCard",
    "tripDetail.ledgerPreview",
    "tripDetail.ledgerSheet",
    "tripDetail.checklistPreview",
    "tripDetail.checklistSheet",
    "agent.proposalCard",
    "agent.messageBubble",
  ]);
  assert.equal(
    new Set(SKIN_SLOT_DEFINITIONS.map((slot) => slot.id)).size,
    SKIN_SLOT_IDS.length,
  );

  for (const slotId of SKIN_SLOT_IDS) {
    assert.equal(isSkinSlotId(slotId), true);
    assert.ok(SKIN_SLOT_DEFINITIONS.some((slot) => slot.id === slotId));
  }

  assert.equal(isSkinSlotId("ui.button"), false);
});

test("skin slots define defaults and unique adapters", () => {
  for (const slot of SKIN_SLOT_DEFINITIONS) {
    const adapterIds = slot.adapters.map((adapter) => adapter.id);

    assert.ok(adapterIds.length >= 1);
    assert.equal(new Set(adapterIds).size, adapterIds.length);
    assert.ok(adapterIds.includes(slot.defaultAdapterId));
    assert.equal(
      getSkinSlotAdapter(slot.id, slot.defaultAdapterId)?.id,
      slot.defaultAdapterId,
    );
  }
});

test("default skin slot adapters are wireframe-oriented", () => {
  const defaultAdapterTitles = [
    getSkinSlotAdapter(
      "home.featuredTripCard",
      skinSlotAdapterIds.homeFeaturedTripCard.default,
    )?.title,
    getSkinSlotAdapter(
      "home.tripListCard",
      skinSlotAdapterIds.homeTripListCard.default,
    )?.title,
    getSkinSlotAdapter(
      "tripDetail.ledgerPreview",
      skinSlotAdapterIds.tripDetailLedgerPreview.default,
    )?.title,
    getSkinSlotAdapter(
      "tripDetail.checklistPreview",
      skinSlotAdapterIds.tripDetailChecklistPreview.default,
    )?.title,
  ];

  for (const title of defaultAdapterTitles) {
    assert.match(title ?? "", /线框/);
  }
});

test("foundation ui parts are locked to the main skin", () => {
  const lockedIds = SKIN_FOUNDATION_LOCKED_PARTS.map((part) => part.id);

  assert.deepEqual(lockedIds, [
    "ui.button",
    "ui.card",
    "ui.input",
    "ui.dialog",
    "ui.badge",
  ]);
  for (const lockedId of lockedIds) {
    assert.equal(isSkinSlotId(lockedId), false);
  }
});

test("theme definitions act as skin packs for default adapters and overrides", () => {
  for (const definition of THEME_DEFINITIONS) {
    assert.ok(definition.skin);
    assert.ok(
      definition.skin.allowedOverrideSlots.includes("home.featuredTripCard"),
    );
    assert.ok(definition.skin.allowedOverrideSlots.includes("shell.tabBar"));
    assert.equal(
      definition.skin.allowedOverrideSlots.includes("tripDetail.ledgerSheet"),
      false,
    );

    for (const slotId of definition.skin.allowedOverrideSlots) {
      assert.ok(
        getSkinSlotAdapter(
          slotId,
          getSkinSlotDefaultAdapterId(definition.skin, slotId),
        ),
      );
    }
  }

  assert.equal(
    getSkinSlotDefaultAdapterId(
      getThemeDefinition("default").skin,
      "home.tripListCard",
    ),
    skinSlotAdapterIds.homeTripListCard.default,
  );
  assert.equal(
    getSkinSlotDefaultAdapterId(
      getThemeDefinition("classic").skin,
      "home.tripListCard",
    ),
    skinSlotAdapterIds.homeTripListCard.classic,
  );
});

test("slot override normalization ignores unknown or locked selections", () => {
  const defaultTheme = getThemeDefinition("default");
  const overrides = normalizeSkinSlotOverrides(
    {
      "home.tripListCard": skinSlotAdapterIds.homeTripListCard.classic,
      "tripDetail.ledgerSheet":
        skinSlotAdapterIds.tripDetailLedgerSheet.classic,
      "ui.button": "paper",
      "missing.slot": "paper",
    },
    defaultTheme,
  );

  assert.deepEqual(overrides, {
    "home.tripListCard": skinSlotAdapterIds.homeTripListCard.classic,
  });
});

test("resolved skin slots prefer valid user overrides and keep source metadata", () => {
  const defaultTheme = getThemeDefinition("default");
  const resolved = resolveSkinSlots(defaultTheme, {
    "home.tripListCard": skinSlotAdapterIds.homeTripListCard.classic,
  });

  assert.equal(
    resolved["home.tripListCard"].adapterId,
    skinSlotAdapterIds.homeTripListCard.classic,
  );
  assert.equal(resolved["home.tripListCard"].source, "userOverride");
  assert.equal(
    resolved["home.featuredTripCard"].adapterId,
    skinSlotAdapterIds.homeFeaturedTripCard.default,
  );
  assert.equal(resolved["home.featuredTripCard"].source, "themeDefault");

  const lockedSlotId: SkinSlotId = "tripDetail.ledgerSheet";
  assert.equal(resolved[lockedSlotId].isUserConfigurable, false);
});
