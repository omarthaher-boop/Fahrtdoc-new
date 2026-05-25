import { Platform } from "react-native";

/**
 * Returns true when the web app is running inside a Median.co native wrapper.
 * Always false on native React Native builds.
 */
export function isMedianApp(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.indexOf("median") > -1;
}

// Expose as a global variable on window so inline scripts and third-party
// code can access it without importing this module.
if (Platform.OS === "web" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).isMedianApp = isMedianApp();
}
