import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let notificationInterval: ReturnType<typeof setInterval> | null = null;

function getTripTypeLabel(type: string): string {
  switch (type) {
    case "business":
      return "Geschäftlich";
    case "arbeitsweg":
      return "Arbeitsweg";
    case "private":
      return "Privat";
    default:
      return "Fahrt";
  }
}

export async function startTripNotifications(
  tripType: string,
  getStats?: () => { km: number; elapsed: number },
): Promise<void> {
  if (Platform.OS === "web") return;

  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🚗 FahrtDoc — Fahrt läuft",
        body: `${getTripTypeLabel(tripType)} · Aufzeichnung aktiv`,
        data: { type: "trip_active", tripNotification: true },
      },
      trigger: null,
    });
  } catch {
    // ignore
  }

  notificationInterval = setInterval(async () => {
    const stats = getStats?.();
    const body = stats
      ? `${getTripTypeLabel(tripType)} · ${stats.km.toFixed(1)} km · ${Math.floor(stats.elapsed / 60)} min`
      : `${getTripTypeLabel(tripType)} · Aufzeichnung läuft weiter`;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚗 FahrtDoc — Fahrt läuft",
          body,
          data: { type: "trip_reminder", tripNotification: true },
        },
        trigger: null,
      });
    } catch {
      // ignore
    }
  }, 10 * 60 * 1000);
}

export async function stopTripNotifications(
  finalKm?: number,
  tripType?: string,
): Promise<void> {
  if (Platform.OS === "web") return;

  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // ignore
  }

  if (finalKm !== undefined && tripType !== undefined) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "✅ FahrtDoc — Fahrt beendet",
          body: `${finalKm.toFixed(1)} km · ${getTripTypeLabel(tripType)} · gespeichert`,
          data: { type: "trip_ended", tripNotification: true },
        },
        trigger: null,
      });
    } catch {
      // ignore
    }
  }
}
