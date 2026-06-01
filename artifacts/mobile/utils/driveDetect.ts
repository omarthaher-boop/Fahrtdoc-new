import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";

export const DRIVE_DETECT_TASK = "DRIVELOG_DRIVE_DETECT";

export const DRIVE_TRIP_ACTIVE_KEY = "fahrtdoc_trip_active";
export const DRIVE_REMIND_KEY = "fahrtdoc_drive_remind";
const DRIVE_STATE_KEY = "fahrtdoc_drive_state";
const DRIVE_COOLDOWN_KEY = "fahrtdoc_notify_cooldown";
const DRIVE_WATCHDOG_KEY = "fahrtdoc_watchdog_notif_id";

const SPEED_DRIVING_MS = 7;
const SPEED_PARKED_MS = 2.5;
const COOLDOWN_MS = 5 * 60 * 1000;
/** If the background task hasn't fired in this many seconds, fire the watchdog notification. */
const WATCHDOG_SECONDS = 5 * 60;

type DriveState = "driving" | "parked";

type TaskData = {
  locations: {
    coords: {
      speed: number | null;
    };
  }[];
};

async function sendNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

/** Cancel any pending watchdog notification. Call this when a trip ends intentionally or auto-tracking is disabled. */
export async function cancelDriveWatchdog(): Promise<void> {
  try {
    const storedId = await AsyncStorage.getItem(DRIVE_WATCHDOG_KEY);
    if (storedId) {
      await Notifications.cancelScheduledNotificationAsync(storedId);
      await AsyncStorage.removeItem(DRIVE_WATCHDOG_KEY);
    }
  } catch {
    // Non-fatal
  }
}

const LANG_KEY = "pref_language";

const DRIVE_NOTIF_STRINGS: Record<
  string,
  { startTitle: string; startBody: string; stopTitle: string; stopBody: string }
> = {
  de: {
    startTitle: "FahrtDoc – Fahrt dokumentieren?",
    startBody: "Du fährst — möchtest du diese Fahrt aufzeichnen?",
    stopTitle: "FahrtDoc – Fahrt beenden?",
    stopBody: "Du scheinst geparkt zu haben — Fahrt jetzt beenden?",
  },
  en: {
    startTitle: "FahrtDoc – Record trip?",
    startBody: "You're driving — would you like to record this trip?",
    stopTitle: "FahrtDoc – End trip?",
    stopBody: "Looks like you've parked — end the trip now?",
  },
};

const WATCHDOG_STRINGS: Record<string, { title: string; body: string }> = {
  de: {
    title: "FahrtDoc – Fahrterkennung gestoppt",
    body: "Die automatische Fahrterkennung wurde unterbrochen. Bitte App öffnen um die Fahrt zu sichern.",
  },
  en: {
    title: "FahrtDoc – Drive detection stopped",
    body: "Automatic drive detection was interrupted. Please open the app to save your trip.",
  },
};

/**
 * Schedule (or reschedule) a watchdog notification. The notification fires
 * WATCHDOG_SECONDS in the future. If the background task keeps running it
 * will cancel and reschedule before it ever fires.
 */
async function rescheduleWatchdog(): Promise<void> {
  try {
    const [storedId, lang] = await Promise.all([
      AsyncStorage.getItem(DRIVE_WATCHDOG_KEY),
      AsyncStorage.getItem(LANG_KEY),
    ]);
    if (storedId) {
      await Notifications.cancelScheduledNotificationAsync(storedId).catch(() => {});
    }
    const strings = WATCHDOG_STRINGS[lang ?? "de"] ?? WATCHDOG_STRINGS["de"];
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: strings.title,
        body: strings.body,
        sound: true,
        data: { watchdog: true },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: WATCHDOG_SECONDS },
    });
    await AsyncStorage.setItem(DRIVE_WATCHDOG_KEY, id);
  } catch {
    // Non-fatal
  }
}

// Background tasks are not supported in Expo Go — skip registration there.
if (Constants.appOwnership !== "expo") {
  try {
    TaskManager.defineTask(
      DRIVE_DETECT_TASK,
      async ({ data, error }: TaskManager.TaskManagerTaskBody<TaskData>) => {
        if (error || !data?.locations?.length) return;

        try {
          const [remindRaw, tripActiveRaw, stateRaw, cooldownRaw, langRaw] =
            await AsyncStorage.multiGet([
              DRIVE_REMIND_KEY,
              DRIVE_TRIP_ACTIVE_KEY,
              DRIVE_STATE_KEY,
              DRIVE_COOLDOWN_KEY,
              LANG_KEY,
            ]);

          const remindEnabled = remindRaw[1] === "true";
          if (!remindEnabled) {
            await cancelDriveWatchdog();
            return;
          }

          const tripActive = tripActiveRaw[1] === "true";
          const prevState = stateRaw[1] as DriveState | null;
          const lastNotify = cooldownRaw[1] ? parseInt(cooldownRaw[1], 10) : 0;
          const now = Date.now();
          const driveStrings =
            DRIVE_NOTIF_STRINGS[langRaw[1] ?? "de"] ?? DRIVE_NOTIF_STRINGS["de"];

          // Watchdog: keep rescheduling while a trip is active so if the task
          // is killed by the OS the notification fires automatically.
          if (tripActive) {
            await rescheduleWatchdog();
          } else {
            await cancelDriveWatchdog();
          }

          const latestSpeed = data.locations[data.locations.length - 1].coords.speed;
          if (latestSpeed === null || latestSpeed < 0) return;

          let curState: DriveState | null = null;
          if (latestSpeed >= SPEED_DRIVING_MS) curState = "driving";
          else if (latestSpeed < SPEED_PARKED_MS) curState = "parked";

          if (!curState) return;

          await AsyncStorage.setItem(DRIVE_STATE_KEY, curState);

          if (now - lastNotify < COOLDOWN_MS) return;

          if (curState === "driving" && prevState !== "driving" && !tripActive) {
            await sendNotification(driveStrings.startTitle, driveStrings.startBody);
            await AsyncStorage.setItem(DRIVE_COOLDOWN_KEY, String(now));
          } else if (curState === "parked" && prevState === "driving" && tripActive) {
            await sendNotification(driveStrings.stopTitle, driveStrings.stopBody);
            await AsyncStorage.setItem(DRIVE_COOLDOWN_KEY, String(now));
          }
        } catch {
          // Non-fatal
        }
      }
    );
  } catch {
    // defineTask unavailable (e.g. Expo Go) — drive detection disabled
  }
}
