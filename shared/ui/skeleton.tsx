import { StyleSheet, View } from "react-native";

import { useAppTheme } from "@/shared/theme/use-app-theme";

const tripListSkeletonCardKeys = ["first", "second", "third"] as const;

type SkeletonBoneProps = {
  borderRadius?: number;
  height?: number;
  width?: number;
};

export function SkeletonBone({
  borderRadius = 8,
  height = 16,
  width,
}: SkeletonBoneProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.bone,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius,
          height,
          width: width ?? undefined,
          flex: width ? undefined : 1,
        },
      ]}
    />
  );
}

export function TripListSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {tripListSkeletonCardKeys.map((cardKey) => (
        <View key={cardKey} style={styles.skeletonCard}>
          <View style={styles.skeletonHeader}>
            <View style={{ flex: 0.6 }}>
              <SkeletonBone height={20} />
            </View>
            <SkeletonBone borderRadius={12} height={24} width={60} />
          </View>
          <View style={{ flex: 0.8 }}>
            <SkeletonBone height={14} />
          </View>
          <View style={styles.skeletonFooter}>
            <SkeletonBone height={12} width={80} />
            <SkeletonBone height={12} width={50} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    overflow: "hidden",
  },
  skeletonList: {
    gap: 12,
  },
  skeletonCard: {
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  skeletonFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 4,
  },
});
