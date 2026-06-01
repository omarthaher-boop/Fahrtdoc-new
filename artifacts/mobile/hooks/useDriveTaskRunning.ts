import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { DRIVE_DETECT_TASK } from "@/utils/driveDetect";

const POLL_INTERVAL_MS = 12_000;

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
    checkDriveTask();
    const interval = setInterval(checkDriveTask, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkDriveTask]);

  return driveTaskRunning;
}
