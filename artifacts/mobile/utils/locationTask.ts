import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "DRIVELOG_BG_LOCATION";
export const BG_POSITIONS_KEY = "fahrtdoc_bg_positions";

export interface BgPosition {
  lat: number;
  lon: number;
  ts: number;
}

const MAX_ACCURACY_M = 30;

type TaskData = {
  locations: {
    coords: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      speed: number | null;
    };
    timestamp: number;
  }[];
};

// Background tasks are not supported in Expo Go — skip registration there.
if (Constants.appOwnership !== "expo") {
  try {
    TaskManager.defineTask(
      LOCATION_TASK_NAME,
      async ({ data, error }: TaskManager.TaskManagerTaskBody<TaskData>) => {
        if (error) return;
        const { locations } = data;
        try {
          const raw = await AsyncStorage.getItem(BG_POSITIONS_KEY);
          const existing: BgPosition[] = raw ? (JSON.parse(raw) as BgPosition[]) : [];
          for (const loc of locations) {
            if (loc.coords.accuracy !== null && loc.coords.accuracy > MAX_ACCURACY_M) continue;
            existing.push({
              lat: loc.coords.latitude,
              lon: loc.coords.longitude,
              ts: loc.timestamp,
            });
          }
          await AsyncStorage.setItem(BG_POSITIONS_KEY, JSON.stringify(existing));
        } catch {
          // Storage errors are non-fatal
        }
      }
    );
  } catch {
    // defineTask unavailable (e.g. Expo Go) — GPS tracking disabled
  }
}
