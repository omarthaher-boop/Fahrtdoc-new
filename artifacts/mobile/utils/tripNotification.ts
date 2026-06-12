import AsyncStorage from "@react-native-async-storage/async-storage";
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

async function getLanguage(): Promise<"de" | "en"> {
  try {
    const val = await AsyncStorage.getItem("pref_language");
    return val === "en" ? "en" : "de";
  } catch {
    return "de";
  }
}

function formatDuration(seconds: number, lang: "de" | "en"): string {
  const totalMin = Math.floor(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (lang === "en") {
    if (h > 0) return `${h} hr ${m} min`;
    if (totalMin === 0) return "0 min";
    return `${totalMin} min`;
  }
  if (h > 0) return `${h} Std. ${m} Min.`;
  if (totalMin === 0) return "0 Min.";
  return `${totalMin} Min.`;
}

export async function showTripNotification(
  type: "business" | "private" | "arbeitsweg",
  elapsedSec: number,
  distanceKm: number
) {
  if (Platform.OS === "web") return;
  const lang = await getLanguage();
  const label =
    lang === "en"
      ? type === "business"
        ? "Business trip"
        : type === "arbeitsweg"
          ? "Commute"
          : "Private trip"
      : type === "business"
        ? "Dienstfahrt"
        : type === "arbeitsweg"
          ? "Arbeitsweg"
          : "Privatfahrt";
  const running = lang === "en" ? "running" : "läuft";
  const km =
    lang === "en"
      ? distanceKm.toFixed(1)
      : distanceKm.toFixed(1).replace(".", ",");
  const dur = formatDuration(elapsedSec, lang);

  await Notifications.scheduleNotificationAsync({
    identifier: TRIP_NOTIFICATION_ID,
    content: {
      title: `\uD83D\uDE97 ${label} ${running}`,
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
