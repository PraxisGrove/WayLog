import { Image, Text, View } from "react-native";
import { formatPlacePoiType, type TripPlace } from "@/features/trips";
import { PlaceLogo } from "@/shared/places/place-logo";

import type { createPlaceDetailStyles } from "../trip-place-detail.styles";
function getPlaceHeroTags(place: TripPlace, statusLabel: string): string[] {
  const tags = [
    statusLabel,
    place.category,
    formatPlacePoiType(place.poiType),
    place.area,
  ];

  return [...new Set(tags.filter((tag): tag is string => Boolean(tag)))];
}

type PlaceHeroProps = {
  coverPhoto?: NonNullable<TripPlace["photos"]>[number];
  isImageReady: boolean;
  place: TripPlace;
  statusLabel: string;
  styles: ReturnType<typeof createPlaceDetailStyles>;
};

export function PlaceHero({
  coverPhoto,
  isImageReady,
  place,
  statusLabel,
  styles,
}: PlaceHeroProps) {
  const heroTags = getPlaceHeroTags(place, statusLabel);

  return (
    <View style={styles.heroPanel}>
      <View style={styles.heroMedia}>
        {coverPhoto && isImageReady ? (
          <Image source={{ uri: coverPhoto.url }} style={styles.heroImage} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <PlaceLogo
              category={place.category}
              iconKey={place.iconKey}
              size={58}
            />
            <Text style={styles.heroPlaceholderText}>
              {coverPhoto ? "封面加载中" : "封面待补"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.heroInfo}>
        <View style={styles.heroTitleRow}>
          <View style={styles.heroTitleCopy}>
            <Text numberOfLines={2} style={styles.placeTitle}>
              {place.name}
            </Text>
            <View style={styles.badgeRow}>
              {heroTags.map((tag) => (
                <View key={tag} style={styles.badge}>
                  <Text style={styles.badgeText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.heroCategoryIcon}>
            <PlaceLogo
              category={place.category}
              iconKey={place.iconKey}
              size={38}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
