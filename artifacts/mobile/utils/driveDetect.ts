import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { translations } from "../context/LanguageContext";

export const DRIVE_DETECT_TASK = "DRIVELOG_DRIVE_DETECT";

export const DRIVE_TRIP_ACTIVE_KEY = "fahrtdoc_trip_active";
export const DRIVE_REMIND_KEY = "fahrtdoc_drive_remind";
const DRIVE_STATE_KEY = "fahrtdoc_drive_state";
const DRIVE_COOLDOWN_KEY = "fahrtdoc_notify_cooldown";
const DRIVE_WATCHDOG_KEY = "fahrtdoc_watchdog_notif_id";

export const DRIVE_DETECT_STOPPED_AT_KEY = "fahrtdoc_detect_stopped_at";
const DRIVE_DETECT_STOPPED_NOTIF_SENT_KEY = "fahrtdoc_detect_stopped_notif";
/** Written by the background task each time it fires successfully. */
export const DRIVE_DETECT_HEARTBEAT_KEY = "fahrtdoc_detect_heartbeat";
/** AsyncStorage key for user-configurable stopped-notification threshold (stored as minutes string). */
export const DRIVE_DETECT_STOPPED_THRESHOLD_KEY = "fahrtdoc_detect_stopped_threshold_min";
/** Default threshold in minutes. */
const DEFAULT_STOPPED_THRESHOLD_MIN = 2;
/** A heartbeat written within this window means the task is still alive. */
const HEARTBEAT_FRESH_MS = 10 * 60 * 1000;

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


const DETECT_STOPPED_STRINGS: Record<string, { title: string; body: string }> = {
  de: {
    title: "FahrtDoc – Fahrterkennung pausiert",
    body: "Die automatische Fahrterkennung ist seit über 2 Minuten gestoppt. Tippe hier, um sie neu zu starten.",
  },
  en: {
    title: "FahrtDoc – Drive detection paused",
    body: "Automatic drive detection has been stopped for over 2 minutes. Tap here to restart it.",
  },
};

/**
 * Record the moment the drive-detect task was first observed as stopped.
 * Idempotent — only writes if no existing timestamp is stored.
 */
export async function recordDriveDetectStopped(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(DRIVE_DETECT_STOPPED_AT_KEY);
    if (!existing) {
      await AsyncStorage.setItem(DRIVE_DETECT_STOPPED_AT_KEY, String(Date.now()));
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Clear the stopped-at timestamp and the "notification sent" flag.
 * Call this when the drive-detect task is confirmed running again.
 */
export async function clearDriveDetectStopped(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([DRIVE_DETECT_STOPPED_AT_KEY, DRIVE_DETECT_STOPPED_NOTIF_SENT_KEY]);
  } catch {
    // Non-fatal
  }
}

/**
 * If the drive-detect task has been stopped for ≥ the user-configured threshold
 * (default 2 min) and the notification has not yet been sent for this outage,
 * fires a local push notification and marks it as sent so it won't repeat.
 *
 * A fresh heartbeat (written by the background task itself each time it runs)
 * takes precedence over the stopped-at key — if the task fired recently the
 * notification is suppressed and the stopped state is cleared automatically.
 */
export async function checkAndSendDriveDetectStoppedNotif(lang: string): Promise<void> {
  try {
    const [stoppedAtRaw, sentRaw, heartbeatRaw, thresholdRaw] = await AsyncStorage.multiGet([
      DRIVE_DETECT_STOPPED_AT_KEY,
      DRIVE_DETECT_STOPPED_NOTIF_SENT_KEY,
      DRIVE_DETECT_HEARTBEAT_KEY,
      DRIVE_DETECT_STOPPED_THRESHOLD_KEY,
    ]);
    const stoppedAt = stoppedAtRaw[1] ? parseInt(stoppedAtRaw[1], 10) : null;
    const alreadySent = sentRaw[1] === "true";
    const lastHeartbeat = heartbeatRaw[1] ? parseInt(heartbeatRaw[1], 10) : null;

    // If the background task fired recently, the task is still alive — clear any
    // stale stopped state and skip the notification.
    if (lastHeartbeat !== null && Date.now() - lastHeartbeat < HEARTBEAT_FRESH_MS) {
      await AsyncStorage.multiRemove([DRIVE_DETECT_STOPPED_AT_KEY, DRIVE_DETECT_STOPPED_NOTIF_SENT_KEY]);
      return;
    }

    if (!stoppedAt || alreadySent) return;
    const thresholdMin = thresholdRaw[1] ? parseInt(thresholdRaw[1], 10) : DEFAULT_STOPPED_THRESHOLD_MIN;
    const thresholdMs = thresholdMin * 60 * 1000;
    if (Date.now() - stoppedAt < thresholdMs) return;

    const strings = DETECT_STOPPED_STRINGS[lang] ?? DETECT_STOPPED_STRINGS["en"];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: strings.title,
        body: strings.body,
        sound: true,
        data: { driveDetectStopped: true },
      },
      trigger: null,
    });
    await AsyncStorage.setItem(DRIVE_DETECT_STOPPED_NOTIF_SENT_KEY, "true");
  } catch {
    // Non-fatal
  }
}


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
    const langKey = (lang === "en" ? "en" : "de") as keyof typeof translations;
    const dict = translations[langKey];
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: dict["watchdog.title"],
        body: dict["watchdog.body"],
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

        // Write a heartbeat so checkAndSendDriveDetectStoppedNotif can confirm
        // the task is still alive even when the banner component is not mounted.
        await AsyncStorage.setItem(DRIVE_DETECT_HEARTBEAT_KEY, String(Date.now())).catch(() => {});

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
          const langKey = (langRaw[1] === "en" ? "en" : "de") as keyof typeof translations;
          const driveDict = translations[langKey];

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
            await sendNotification(driveDict["driveNotif.startTitle"], driveDict["driveNotif.startBody"]);
            await AsyncStorage.setItem(DRIVE_COOLDOWN_KEY, String(now));
          } else if (curState === "parked" && prevState === "driving" && tripActive) {
            await sendNotification(driveDict["driveNotif.stopTitle"], driveDict["driveNotif.stopBody"]);
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
