import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import type { Trip } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import type { createStyles } from "../../trip-detail.styles";
import { InfoPanel } from "./info-panel";

type TravelInfoSectionProps = {
  onAddMemoPress: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  trip: Trip;
};

export function TravelInfoSection({
  onAddMemoPress,
  styles,
  theme,
  trip,
}: TravelInfoSectionProps) {
  return (
    <View style={styles.travelInfoSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>出行信息</Text>
          <Text style={styles.sectionHint}>酒店 / 交通 / 提醒</Text>
        </View>
        <Pressable
          accessibilityLabel="添加备忘"
          accessibilityRole="button"
          onPress={onAddMemoPress}
          style={({ pressed }) => [
            styles.sectionActionButton,
            pressed && [
              styles.sectionActionButtonPressed,
              { backgroundColor: theme.colors.primarySoft },
            ],
          ]}
        >
          <MaterialIcons name="add" size={18} color={theme.colors.primary} />
          <Text style={styles.sectionActionText}>添加备忘</Text>
        </Pressable>
      </View>

      <View style={styles.infoGrid}>
        <InfoPanel
          emptyText="还没有交通信息"
          icon="directions-transit"
          items={trip.transports.map((transport) => ({
            id: transport.id,
            title: transport.title,
            detail: [
              transport.type,
              transport.detail,
              transport.departureTime ?? transport.arrivalTime,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
          title="交通"
        />
        <InfoPanel
          emptyText="还没有住宿信息"
          icon="hotel"
          items={trip.lodgings.map((lodging) => ({
            id: lodging.id,
            title: lodging.name,
            detail: [
              lodging.address,
              lodging.checkIn && lodging.checkOut
                ? `${lodging.checkIn} - ${lodging.checkOut}`
                : lodging.note,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
          title="住宿"
        />
        <InfoPanel
          emptyText="还没有重要提醒"
          icon="notifications-none"
          items={trip.memos.map((memo) => ({
            id: memo.id,
            title: memo.title,
            detail: memo.detail,
          }))}
          title="提醒"
        />
      </View>
    </View>
  );
}
