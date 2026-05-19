import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const TRIP_NOTIFICATION_ID = "fahrtdoc_active_trip";
const ANDROID_CHANNEL_ID = "trip_tracking";

export async function setupTripNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Aktive Fahrt",
    importance: Notifications.AndroidImportance.LOW,
    showBadge: false,
    vibrationPattern: null,
    sound: null,
  });
}

function formatDuration(seconds: number): string {
  const totalMin = Math.floor(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} Std. ${m} Min.`;
  if (totalMin === 0) return "0 Min.";
  return `${totalMin} Min.`;
}

export async function showTripNotification(
  type: "business" | "private",
  elapsedSec: number,
  distanceKm: number
) {
  if (Platform.OS === "web") return;
  const label = type === "business" ? "Dienstfahrt" : "Privatfahrt";
  const km = distanceKm.toFixed(1).replace(".", ",");
  const dur = formatDuration(elapsedSec);

  await Notifications.scheduleNotificationAsync({
    identifier: TRIP_NOTIFICATION_ID,
    content: {
      title: `\uD83D\uDE97 ${label} laeuft`,
      body: `${dur}  \u00B7  ${km} km`,
      sticky: true,
      data: { tripNotification: true },
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

export async function hideTripNotification() {
  if (Platform.OS === "web") return;
  await Notifications.dismissNotificationAsync(TRIP_NOTIFICATION_ID);
}
