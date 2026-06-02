import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DRIVE_DETECT_TASK, DRIVE_DETECT_HEARTBEAT_KEY } from "@/utils/driveDetect";

const POLL_INTERVAL_MS = 12_000;
const HEARTBEAT_FRESH_MS = 10 * 60 * 1000;

export function useDriveTaskRunning() {
  const [driveTaskRunning, setDriveTaskRunning] = useState(false);

  const checkDriveTask = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      const Location = await import("expo-location");
      const running = await Location.hasStartedLocationUpdatesAsync(DRIVE_DETECT_TASK);
      setDriveTaskRunning(running);
    } catch {
      setDriveTaskRunning(false);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      AsyncStorage.getItem(DRIVE_DETECT_HEARTBEAT_KEY)
        .then((raw) => {
          if (raw && Date.now() - parseInt(raw, 10) < HEARTBEAT_FRESH_MS) {
            setDriveTaskRunning(true);
          }
        })
        .catch(() => {});
    }
    checkDriveTask();
    const interval = setInterval(checkDriveTask, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkDriveTask]);

  return driveTaskRunning;
}
