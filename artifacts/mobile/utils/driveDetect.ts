import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";

export const DRIVE_DETECT_TASK = "DRIVELOG_DRIVE_DETECT";

export const DRIVE_TRIP_ACTIVE_KEY = "fahrtdoc_trip_active";
export const DRIVE_REMIND_KEY = "fahrtdoc_drive_remind";
const DRIVE_STATE_KEY = "fahrtdoc_drive_state";
const DRIVE_COOLDOWN_KEY = "fahrtdoc_notify_cooldown";

const SPEED_DRIVING_MS = 7;
const SPEED_PARKED_MS = 2.5;
const COOLDOWN_MS = 5 * 60 * 1000;

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

// Background tasks are not supported in Expo Go — skip registration there.
if (Constants.appOwnership !== "expo") {
  try {
    TaskManager.defineTask(
      DRIVE_DETECT_TASK,
      async ({ data, error }: TaskManager.TaskManagerTaskBody<TaskData>) => {
        if (error || !data?.locations?.length) return;

        try {
          const [remindRaw, tripActiveRaw, stateRaw, cooldownRaw] =
            await AsyncStorage.multiGet([
              DRIVE_REMIND_KEY,
              DRIVE_TRIP_ACTIVE_KEY,
              DRIVE_STATE_KEY,
              DRIVE_COOLDOWN_KEY,
            ]);

          const remindEnabled = remindRaw[1] === "true";
          if (!remindEnabled) return;

          const tripActive = tripActiveRaw[1] === "true";
          const prevState = stateRaw[1] as DriveState | null;
          const lastNotify = cooldownRaw[1] ? parseInt(cooldownRaw[1], 10) : 0;
          const now = Date.now();

          const latestSpeed = data.locations[data.locations.length - 1].coords.speed;
          if (latestSpeed === null || latestSpeed < 0) return;

          let curState: DriveState | null = null;
          if (latestSpeed >= SPEED_DRIVING_MS) curState = "driving";
          else if (latestSpeed < SPEED_PARKED_MS) curState = "parked";

          if (!curState) return;

          await AsyncStorage.setItem(DRIVE_STATE_KEY, curState);

          if (now - lastNotify < COOLDOWN_MS) return;

          if (curState === "driving" && prevState !== "driving" && !tripActive) {
            await sendNotification(
              "FahrtDoc – Fahrt dokumentieren?",
              "Du fährst — möchtest du diese Fahrt aufzeichnen?"
            );
            await AsyncStorage.setItem(DRIVE_COOLDOWN_KEY, String(now));
          } else if (curState === "parked" && prevState === "driving" && tripActive) {
            await sendNotification(
              "FahrtDoc – Fahrt beenden?",
              "Du scheinst geparkt zu haben — Fahrt jetzt beenden?"
            );
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
