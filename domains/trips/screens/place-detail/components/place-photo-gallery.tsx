import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { TripPlace } from "@/features/trips";
import type { TripPlaceExternalImage } from "@/features/trips/types";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import {
  type createPlaceDetailStyles,
  SCREEN_WIDTH,
} from "../trip-place-detail.styles";
export function PhotoGallery({
  place,
  externalImages,
  isReady,
  isLoadingImages,
  onImagePress,
  styles,
}: {
  place: TripPlace;
  externalImages: TripPlaceExternalImage[];
  isReady: boolean;
  isLoadingImages: boolean;
  onImagePress: (index: number) => void;
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  const theme = useAppTheme();
  const allPhotos = isReady
    ? [
        ...(place.photos?.map((p) => ({
          id: p.id,
          url: p.url,
          source: p.sourceLabel,
        })) ?? []),
        ...externalImages.map((p) => ({
          id: p.id,
          url: p.url,
          source: p.source,
        })),
      ]
    : [];
  const isPreparingImages = !isReady || isLoadingImages;

  if (allPhotos.length === 0) {
    return (
      <View style={styles.photoEmptyState}>
        <View style={styles.photoEmptyIcon}>
          <MaterialIcons
            name="photo-library"
            size={22}
            color={theme.colors.textMuted}
          />
        </View>
        <View style={styles.photoEmptyCopy}>
          <Text style={styles.itemTitle}>
            {isPreparingImages ? "正在加载图片..." : "暂无照片"}
          </Text>
          <Text style={styles.mutedText}>
            {isPreparingImages ? "加载中" : "0 张"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.photoRailContent}
      style={styles.photoRail}
    >
      {allPhotos.map((photo, index) => (
        <Pressable
          key={photo.id}
          onPress={() => onImagePress(index)}
          style={({ pressed }) => [
            styles.photoSlot,
            pressed && styles.photoSlotPressed,
          ]}
        >
          <Image source={{ uri: photo.url }} style={styles.photoSlotImage} />
          {photo.source ? (
            <Text numberOfLines={1} style={styles.photoSourceBadge}>
              {photo.source}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function ImageViewer({
  images,
  initialIndex,
  onClose,
  styles,
}: {
  images: { id: string; url: string; source?: string }[];
  initialIndex: number;
  onClose: () => void;
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: initialIndex * SCREEN_WIDTH,
        animated: false,
      });
    }
  }, [initialIndex]);

  const handleScroll = (event: {
    nativeEvent: { contentOffset: { x: number } };
  }) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.imageViewerContainer}>
        <Pressable style={styles.imageViewerClose} onPress={onClose}>
          <MaterialIcons name="close" size={28} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.imageViewerCounter}>
          {currentIndex + 1} / {images.length}
        </Text>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.imageViewerScroll}
        >
          {images.map((image) => (
            <View key={image.id} style={styles.imageViewerSlide}>
              <Image
                source={{ uri: image.url }}
                style={styles.imageViewerImage}
                resizeMode="contain"
              />
              {image.source ? (
                <Text style={styles.imageViewerSource}>{image.source}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
