import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  formatExpenseAmount,
  formatExpenseInputValue,
  type PlaceInfoLink,
  type TripDayItem,
  type TripExpenseEntry,
  type TripPlace,
} from "@/features/trips";
import type { LLMPlaceSummary } from "@/features/trips/llm";
import type { TripPlaceExternalImage } from "@/features/trips/types";
import type { TripWeatherDayForecast } from "@/features/weather";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ExternalLink } from "@/shared/ui/external-link";

import {
  DetailRow,
  ImageViewer,
  InfoLinkContent,
  InsightPair,
  PhotoGallery,
  PlaceExpensePreview,
  PlaceHero,
  PlaceholderDetailRow,
  PlaceMapPreview,
  PlaceReviewPreview,
  PlaceWeatherPreview,
  RecordMetric,
  ScheduleCostEditor,
  ScheduleNoteEditor,
} from "../place-detail-components";
import {
  formatExpenseEntryRecordedAt,
  getPlaceMetricValue,
  getScheduleEntryKey,
} from "../place-detail-utils";
import type { createPlaceDetailStyles } from "../trip-place-detail.styles";

type PlaceScheduleEntry = {
  day: {
    id: string;
    title: string;
  };
  item: TripDayItem;
};

type PlaceDetailContentProps = {
  activeScheduleEntry?: PlaceScheduleEntry;
  actionError: string;
  areExpenseRecordsExpanded: boolean;
  coverPhoto?: NonNullable<TripPlace["photos"]>[number];
  costDraftErrors: Record<string, string>;
  costDrafts: Record<string, string>;
  dashboardScale: number;
  expenseRecordEntries: TripExpenseEntry[];
  externalImages: TripPlaceExternalImage[];
  externalInfoLinks: PlaceInfoLink[];
  isFavoritePlaceDetail: boolean;
  isIntroCollapsed: boolean;
  isLlmLoading: boolean;
  isLoadingImages: boolean;
  isPlaceNoteExpanded: boolean;
  isPostTransitionReady: boolean;
  isReviewExpanded: boolean;
  isWeatherLoading: boolean;
  linkError: string;
  llmSummary: LLMPlaceSummary | null;
  noteDrafts: Record<string, string>;
  onCostCancel: (key: string, savedValue: string) => void;
  onCostChange: (key: string, value: string) => void;
  onExpenseRecordsExpandedChange: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  onImageViewerClose: () => void;
  onInfoLinkOpenError: (error: unknown) => void;
  onInfoLinkPress: () => void;
  onIntroCollapsedChange: (value: boolean) => void;
  onMapPreviewPress: () => void;
  onNoteChange: (key: string, value: string) => void;
  onOpenPlaceNoteEditor: () => void;
  onReviewExpandedChange: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  onSaveCost: (
    dayId: string,
    itemId: string,
    costDraft: string,
  ) => Promise<boolean>;
  onSaveNote: (dayId: string, itemId: string, note: string) => void;
  onSelectImage: (index: number) => void;
  place: TripPlace;
  placeExpenseTotal: number;
  placeIntro: string;
  placeNotePreview: string;
  placeWeatherForecast?: TripWeatherDayForecast;
  recordTags: string[];
  savingCostKey: string;
  savingNoteKey: string;
  selectedImageIndex: number | null;
  statusLabel: string;
  styles: ReturnType<typeof createPlaceDetailStyles>;
  weatherContentScale: number;
};

export function PlaceDetailContent({
  activeScheduleEntry,
  actionError,
  areExpenseRecordsExpanded,
  coverPhoto,
  costDraftErrors,
  costDrafts,
  dashboardScale,
  expenseRecordEntries,
  externalImages,
  externalInfoLinks,
  isFavoritePlaceDetail,
  isIntroCollapsed,
  isLlmLoading,
  isLoadingImages,
  isPlaceNoteExpanded,
  isPostTransitionReady,
  isReviewExpanded,
  isWeatherLoading,
  linkError,
  llmSummary,
  noteDrafts,
  onCostCancel,
  onCostChange,
  onExpenseRecordsExpandedChange,
  onImageViewerClose,
  onInfoLinkOpenError,
  onInfoLinkPress,
  onIntroCollapsedChange,
  onMapPreviewPress,
  onNoteChange,
  onOpenPlaceNoteEditor,
  onReviewExpandedChange,
  onSaveCost,
  onSaveNote,
  onSelectImage,
  place,
  placeExpenseTotal,
  placeIntro,
  placeNotePreview,
  placeWeatherForecast,
  recordTags,
  savingCostKey,
  savingNoteKey,
  selectedImageIndex,
  statusLabel,
  styles,
  weatherContentScale,
}: PlaceDetailContentProps) {
  const theme = useAppTheme();

  const renderScheduleCostEditor = (
    dayId: string,
    item: TripDayItem,
    label = "本次地点花费",
  ) => {
    const costKey = getScheduleEntryKey(dayId, item.id);
    const costDraft = costDrafts[costKey] ?? formatExpenseInputValue(item.cost);
    const savedCostDraft = formatExpenseInputValue(item.cost);
    const hasCostChanges = costDraft.trim() !== savedCostDraft;

    return (
      <ScheduleCostEditor
        error={costDraftErrors[costKey]}
        hasChanges={hasCostChanges}
        isSaving={savingCostKey === costKey}
        label={label}
        onCancel={() => onCostCancel(costKey, savedCostDraft)}
        onChangeText={(value) => onCostChange(costKey, value)}
        onSave={() => onSaveCost(dayId, item.id, costDraft)}
        savedValue={formatExpenseAmount(item.cost)}
        styles={styles}
        value={costDraft}
      />
    );
  };

  const renderScheduleNoteEditor = (
    dayId: string,
    item: TripDayItem,
    label = "备注",
  ) => {
    const noteKey = getScheduleEntryKey(dayId, item.id);
    const noteDraft = noteDrafts[noteKey] ?? item.note ?? "";
    const hasNoteChanges = noteDraft.trim() !== (item.note ?? "");

    return (
      <ScheduleNoteEditor
        hasChanges={hasNoteChanges}
        isSaving={savingNoteKey === noteKey}
        label={label}
        onChangeText={(value) => onNoteChange(noteKey, value)}
        onSave={() => {
          onSaveNote(dayId, item.id, noteDraft);
        }}
        styles={styles}
        value={noteDraft}
      />
    );
  };

  const imageViewerImages =
    selectedImageIndex === null
      ? []
      : [
          ...(place.photos?.map((photo) => ({
            id: photo.id,
            url: photo.url,
            source: photo.sourceLabel,
          })) ?? []),
          ...externalImages.map((image) => ({
            id: image.id,
            url: image.url,
            source: image.source,
          })),
        ];

  return (
    <>
      <PlaceHero
        coverPhoto={coverPhoto}
        isImageReady={isPostTransitionReady}
        place={place}
        statusLabel={statusLabel}
        styles={styles}
      />

      {actionError ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{actionError}</Text>
        </View>
      ) : null}

      <MetricGrid
        expenseRecordEntries={expenseRecordEntries}
        isFavoritePlaceDetail={isFavoritePlaceDetail}
        onOpenExpenses={() => onExpenseRecordsExpandedChange(true)}
        place={place}
        placeExpenseTotal={placeExpenseTotal}
        styles={styles}
      />

      <SectionHeader
        icon="auto-stories"
        right={
          isLlmLoading ? (
            <View style={styles.sourceBadge}>
              <ActivityIndicator size="small" color={theme.colors.textMuted} />
              <Text style={styles.sourceBadgeText}>AI 生成中</Text>
            </View>
          ) : llmSummary ? (
            <View style={styles.sourceBadge}>
              <MaterialIcons
                name="auto-awesome"
                size={12}
                color={theme.colors.textMuted}
              />
              <Text style={styles.sourceBadgeText}>AI 生成</Text>
            </View>
          ) : null
        }
        styles={styles}
        title="地点介绍"
        onPress={() => onIntroCollapsedChange(!isIntroCollapsed)}
      >
        <MaterialIcons
          name={isIntroCollapsed ? "expand-more" : "expand-less"}
          size={20}
          color={theme.colors.textMuted}
        />
      </SectionHeader>

      <View style={styles.card}>
        <View style={styles.introQuoteRow}>
          <View style={styles.introAccent} />
          <Text
            style={[
              styles.introText,
              isIntroCollapsed && styles.introTextCollapsed,
            ]}
            numberOfLines={isIntroCollapsed ? 2 : undefined}
          >
            {llmSummary ? llmSummary.text : placeIntro}
          </Text>
        </View>
      </View>

      <SectionHeader
        hint={`${(place.photos?.length ?? 0) + externalImages.length} 张`}
        icon="photo-library"
        styles={styles}
        title="照片库"
      />

      <View style={styles.card}>
        <PhotoGallery
          isReady={isPostTransitionReady}
          place={place}
          externalImages={externalImages}
          isLoadingImages={isLoadingImages}
          onImagePress={onSelectImage}
          styles={styles}
        />
      </View>

      {selectedImageIndex !== null ? (
        <ImageViewer
          images={imageViewerImages}
          initialIndex={selectedImageIndex}
          onClose={onImageViewerClose}
          styles={styles}
        />
      ) : null}

      <SectionHeader icon="info-outline" styles={styles} title="实用信息" />

      <View style={styles.card}>
        <DetailRow
          icon="place"
          label="地址"
          styles={styles}
          value={place.address}
        />
        <DetailRow
          icon="public"
          label="区域"
          styles={styles}
          value={place.area}
        />
        <DetailRow
          icon="schedule"
          label="营业时间"
          styles={styles}
          value={place.details?.openingHours}
        />
        <DetailRow
          icon="confirmation-number"
          label="门票/费用"
          styles={styles}
          value={place.details?.ticketInfo}
        />
        <DetailRow
          icon="timer"
          label="建议停留"
          styles={styles}
          value={place.details?.visitDuration}
        />
        <DetailRow
          icon="phone"
          label="联系电话"
          styles={styles}
          value={place.details?.phone}
        />
        <DetailRow
          icon="language"
          label="官方网站"
          styles={styles}
          value={place.details?.website}
        />
        {!isFavoritePlaceDetail ? (
          <Pressable
            accessibilityHint="打开地点备注编辑器"
            accessibilityLabel="地点备注"
            accessibilityRole="button"
            onPress={onOpenPlaceNoteEditor}
            style={({ pressed }) => [
              styles.detailRow,
              styles.placeNoteRow,
              pressed && styles.placeNoteRowPressed,
            ]}
          >
            <View style={styles.detailIcon}>
              <MaterialIcons
                name="edit-note"
                size={18}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.detailCopy}>
              <Text style={styles.detailLabel}>地点备注</Text>
              <Text
                numberOfLines={2}
                style={
                  placeNotePreview ? styles.detailValue : styles.placeholderText
                }
              >
                {placeNotePreview || "未添加，点击记录"}
              </Text>
            </View>
            <MaterialIcons
              name={isPlaceNoteExpanded ? "expand-less" : "chevron-right"}
              size={20}
              color={theme.colors.textSubtle}
            />
          </Pressable>
        ) : place.note ? (
          <DetailRow
            icon="edit-note"
            label="地点备注"
            styles={styles}
            value={place.note}
          />
        ) : null}
        {isPlaceNoteExpanded && activeScheduleEntry ? (
          <View style={styles.placeNoteEditorBlock}>
            {renderScheduleNoteEditor(
              activeScheduleEntry.day.id,
              activeScheduleEntry.item,
              "地点备注",
            )}
          </View>
        ) : null}
        <PlaceholderDetailRow
          icon="schedule"
          label="营业时间"
          styles={styles}
          visible={!place.details?.openingHours}
        />
        <PlaceholderDetailRow
          icon="phone"
          label="联系电话"
          styles={styles}
          visible={!place.details?.phone}
        />
      </View>

      <SectionHeader icon="dashboard" styles={styles} title="综合信息" />

      <View style={styles.splitGrid}>
        <PlaceMapPreview
          dashboardScale={dashboardScale}
          isReady={isPostTransitionReady}
          onPress={onMapPreviewPress}
          place={place}
          styles={styles}
        />
        <PlaceWeatherPreview
          forecast={placeWeatherForecast}
          hasCoordinates={
            typeof place.latitude === "number" &&
            typeof place.longitude === "number"
          }
          isLoading={isWeatherLoading}
          scheduleDayTitle={activeScheduleEntry?.day.title}
          styles={styles}
          weatherContentScale={weatherContentScale}
        />
        <PlaceReviewPreview
          place={place}
          recordTags={recordTags}
          onPress={() => onReviewExpandedChange((current) => !current)}
          styles={styles}
        />
        <PlaceExpensePreview
          placeExpenseTotal={placeExpenseTotal}
          expenseRecordEntries={expenseRecordEntries}
          onPress={
            isFavoritePlaceDetail
              ? undefined
              : () => onExpenseRecordsExpandedChange((current) => !current)
          }
          styles={styles}
        />
      </View>

      {isReviewExpanded ? (
        <View style={styles.card}>
          <View style={styles.reviewMoodHeader}>
            <View style={styles.reviewMoodCopy}>
              <Text style={styles.itemTitle}>旅行者视角</Text>
              <Text style={styles.mutedText}>
                {place.details?.ratingSource ?? "个人记录优先"}
              </Text>
            </View>
            <Text style={styles.reviewBadge}>
              {typeof place.details?.reviewCount === "number"
                ? `${place.details.reviewCount} 条`
                : "待记录"}
            </Text>
          </View>
          <InsightPair
            cautions={place.details?.cautions}
            highlights={place.details?.highlights}
            styles={styles}
          />
          <View style={styles.tagRow}>
            {recordTags.map((tag) => (
              <Text key={tag} style={styles.tagChip}>
                {tag}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {areExpenseRecordsExpanded && !isFavoritePlaceDetail ? (
        <View style={styles.card}>
          {activeScheduleEntry
            ? renderScheduleCostEditor(
                activeScheduleEntry.day.id,
                activeScheduleEntry.item,
                "本次地点花费",
              )
            : null}
          {expenseRecordEntries.length > 0 ? (
            expenseRecordEntries.map((entry) => (
              <View key={entry.id} style={styles.expenseRecordRow}>
                <View style={styles.expenseRecordIcon}>
                  <MaterialIcons
                    name="receipt-long"
                    size={17}
                    color={theme.colors.success}
                  />
                </View>
                <View style={styles.expenseRecordCopy}>
                  <Text style={styles.expenseRecordDate}>{entry.title}</Text>
                  <Text style={styles.expenseRecordTime}>
                    {formatExpenseEntryRecordedAt(entry)}
                  </Text>
                </View>
                <Text style={styles.expenseRecordAmount}>
                  {formatExpenseAmount(entry.amount, entry.currency)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyBlock}>
              <MaterialIcons
                name="receipt-long"
                size={28}
                color={theme.colors.textSubtle}
              />
              <Text style={styles.itemTitle}>还没有开销记录</Text>
              <Text style={styles.mutedText}>
                在上方记录本次地点花费后，会自动保存记账时间。
              </Text>
            </View>
          )}
        </View>
      ) : null}

      <SectionHeader
        hint={`${externalInfoLinks.length} 个入口`}
        icon="link"
        styles={styles}
        title="外部信息"
      />

      <View style={[styles.card, styles.externalLinksCard]}>
        {linkError ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{linkError}</Text>
          </View>
        ) : null}

        {externalInfoLinks.map((link, index) => (
          <ExternalLink
            asChild
            href={link.url}
            key={link.id}
            onOpenError={onInfoLinkOpenError}
            onPress={onInfoLinkPress}
            style={[
              styles.linkRow,
              index < externalInfoLinks.length - 1 && styles.linkRowDivider,
            ]}
          >
            <Pressable
              accessibilityHint="在浏览器中打开外部信息"
              accessibilityLabel={`打开${link.title}`}
              accessibilityRole="link"
            >
              <InfoLinkContent link={link} styles={styles} />
            </Pressable>
          </ExternalLink>
        ))}
      </View>
    </>
  );
}

function MetricGrid({
  expenseRecordEntries,
  isFavoritePlaceDetail,
  onOpenExpenses,
  place,
  placeExpenseTotal,
  styles,
}: {
  expenseRecordEntries: TripExpenseEntry[];
  isFavoritePlaceDetail: boolean;
  onOpenExpenses: () => void;
  place: TripPlace;
  placeExpenseTotal: number;
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  return (
    <View style={styles.metricGrid}>
      <RecordMetric
        icon="star-border"
        label="评分"
        styles={styles}
        value={getPlaceMetricValue(place, "rating")}
      />
      <RecordMetric
        icon="photo-library"
        label="图片"
        styles={styles}
        value={getPlaceMetricValue(place, "photos")}
      />
      <RecordMetric
        icon="trending-up"
        label="人均"
        styles={styles}
        value={place.details?.priceLevel || "待补充"}
      />
      <RecordMetric
        icon="receipt-long"
        label="开销"
        onPress={isFavoritePlaceDetail ? undefined : onOpenExpenses}
        styles={styles}
        value={
          expenseRecordEntries.length > 0
            ? formatExpenseAmount(placeExpenseTotal)
            : "待记录"
        }
      />
    </View>
  );
}

function SectionHeader({
  children,
  hint,
  icon,
  onPress,
  right,
  styles,
  title,
}: {
  children?: ReactNode;
  hint?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
  right?: ReactNode;
  styles: ReturnType<typeof createPlaceDetailStyles>;
  title: string;
}) {
  const theme = useAppTheme();
  const Container = onPress ? Pressable : View;

  return (
    <Container style={styles.sectionHeader} onPress={onPress}>
      <View style={styles.sectionTitleRow}>
        <MaterialIcons name={icon} size={18} color={theme.colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
      </View>
      {right}
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </Container>
  );
}
