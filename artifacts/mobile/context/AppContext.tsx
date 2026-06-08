import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as ExpoCrypto from "expo-crypto";
import { secureGetItem, secureSetItem, secureRemoveDataKey } from "@/utils/secureStorage";
import { serverDeleteAccount } from "@/lib/api";
import { LOCATION_TASK_NAME, BG_POSITIONS_KEY, BgPosition } from "@/utils/locationTask";
import { decimatePath } from "@/utils/decimatePath";
import { geocodeAddress } from "@/utils/geocode";
import { DRIVE_DETECT_TASK, DRIVE_TRIP_ACTIVE_KEY, cancelDriveWatchdog, clearDriveDetectStopped } from "@/utils/driveDetect";
import {
  showTripNotification,
  hideTripNotification,
  setupTripNotificationChannel,
} from "@/utils/tripNotification";
import {
  type ApiTrip,
  serverLogin,
  serverRegister,
  fetchServerTrips,
  serverCreateTrip,
  serverUpdateTrip,
  serverDeleteTrip,
  serverBatchUpsertTrips,
  serverRequestChangeCode,
  serverConfirmChangePassword,
  serverRequestEmailChangeCode,
  serverConfirmEmailChange,
} from "@/lib/api";

export interface Waypoint {
  addr: string;
  lat: number;
  lon: number;
  timestamp: number;
  note?: string;
}

export interface Trip {
  id: string;
  date: string;
  startAddr: string;
  endAddr: string;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
  km: number;
  kmRoute?: number;
  dur: number;
  type: "business" | "private";
  edited?: boolean;
  note?: string;
  waypoints?: Waypoint[];
  path?: { lat: number; lon: number }[];
  waypointSyncPending?: boolean;
  syncPending?: "create" | "update";
}

export interface ActiveTrip {
  id: string;
  startTime: number;
  type: "business" | "private";
  startAddr: string;
  distance: number;
  positions: { lat: number; lon: number }[];
  waypoints?: Waypoint[];
  note?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  plate: string;
  companyName?: string;
  logoUri?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  signatureBlock?: boolean;
}

interface StoredAccount {
  name: string;
  plate: string;
  passwordHash: string;
  companyName?: string;
  logoUri?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  signatureBlock?: boolean;
}

interface SessionRecord {
  email: string;
  nonce: string;
  sessionToken: string;
}

interface AppContextType {
  user: UserProfile | null;
  loading: boolean;
  syncStatus: "synced" | "syncing" | "offline";
  isRefreshingAddresses: boolean;
  refreshAddresses: () => Promise<void>;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<"ok" | "not_found" | "wrong_password" | "server_unavailable">;
  register: (name: string, email: string, plate: string, password: string) => Promise<"ok" | "exists">;
  updateProfile: (name: string, plate: string) => Promise<void>;
  updateCompanyInfo: (companyName: string, logoUri: string, signatureBlock?: boolean) => Promise<void>;
  updateVehicleData: (brand: string, model: string, year: string, color: string) => Promise<void>;
  updatePassword: (email: string, newPassword: string) => Promise<void>;
  requestPasswordChangeCode: () => Promise<{ success: boolean; error?: string }>;
  confirmPasswordChange: (code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  requestEmailChangeCode: (newEmail: string) => Promise<{ success: boolean; error?: string }>;
  confirmEmailChange: (code: string, newEmail: string) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  biometricLogin: () => Promise<"ok" | "no_session">;
  trips: Trip[];
  syncRetryingIds: ReadonlySet<string>;
  addTrip: (t: Trip) => void;
  deleteTrip: (id: string) => void;
  editTrip: (id: string, changes: Partial<Trip>) => void;
  retryWaypointSync: (id: string) => Promise<boolean>;
  activeTrip: ActiveTrip | null;
  paused: boolean;
  pauseStartedAt: number | null;
  totalPausedMs: number;
  gpsTracking: boolean;
  gpsStatus: "ok" | "denied" | "waiting";
  livePos: { lat: number; lon: number } | null;
  startTrip: (type: "business" | "private", startAddrOverride?: string) => Promise<void>;
  stopTrip: () => Promise<Trip | null>;
  setActiveTripNote: (note: string) => void;
  togglePause: (waypoint?: Waypoint) => void;
  elapsed: number;
  pendingTrip: Trip | null;
  pendingTripCoords: { startLat: number; startLon: number; endLat: number; endLon: number } | null;
  pendingTripPath: { lat: number; lon: number }[] | null;
  finalizeTrip: (trip: Trip) => Promise<void>;
  discardPendingTrip: () => void;
  setTrackingPref: (key: "autoTracking" | "gpsTracking" | "bgTracking" | "offlineStorage", value: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);


const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fetchOsrmRoute = async (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<number | null> => {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=false`;
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "FahrtDoc/2.4 (info@centofai.com)" },
    });
    clearTimeout(tid);
    const d = await r.json();
    if (d.code === "Ok" && Array.isArray(d.routes) && d.routes.length > 0) {
      return Math.round((d.routes[0].distance / 1000) * 10) / 10;
    }
    return null;
  } catch {
    return null;
  }
};

interface NominatimResult {
  road: string;
  houseNumber: string;
  postcode: string;
  city: string;
}

async function fetchNominatim(lat: number, lon: number, zoom: number): Promise<NominatimResult | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de&zoom=${zoom}&addressdetails=1&namedetails=1`,
      { signal: ctrl.signal, headers: { "User-Agent": "FahrtDoc/2.4 (info@centofai.com)" } }
    );
    clearTimeout(tid);
    if (!r.ok) return null;
    const d = await r.json();
    const road =
      d.address?.road || d.address?.pedestrian || d.address?.path || d.address?.street || "";
    // house_number from structured fields first, then try display_name leading token
    let houseNumber = d.address?.house_number || d.address?.housenumber || "";
    if (!houseNumber && d.display_name) {
      const firstToken = String(d.display_name).split(",")[0]?.trim() ?? "";
      if (/^\d[\d\s\-a-zA-Z]{0,6}$/.test(firstToken)) houseNumber = firstToken;
    }
    const postcode = d.address?.postcode || "";
    const city =
      d.address?.city ||
      d.address?.town ||
      d.address?.village ||
      d.address?.suburb ||
      d.address?.municipality ||
      "";
    return { road, houseNumber, postcode, city };
  } catch {
    return null;
  }
}

function formatNominatimAddress(r: NominatimResult): string {
  const street = r.houseNumber ? `${r.road} ${r.houseNumber}`.trim() : r.road;
  const locality = [r.postcode, r.city].filter(Boolean).join(" ");
  return [street, locality].filter(Boolean).join(", ");
}

export const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
  // First attempt: building level (zoom 19) — highest chance of finding house numbers
  const r1 = await fetchNominatim(lat, lon, 19);
  if (r1?.houseNumber) return formatNominatimAddress(r1);

  // Second attempt: street level (zoom 18) — some house numbers only appear at this level
  await new Promise<void>((resolve) => setTimeout(resolve, 800));
  const r2 = await fetchNominatim(lat, lon, 18);
  if (r2?.houseNumber) return formatNominatimAddress(r2);

  // No house number found — return best street-level result available
  const best = r2 ?? r1;
  if (best) {
    const result = formatNominatimAddress(best);
    if (result) return result;
  }
  return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
};

async function sha256Hex(text: string): Promise<string> {
  return ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, text);
}

function tripsKey(email: string): string {
  return `trips_${email}`;
}

function serverTokenKey(email: string): string {
  return `server_token_${email}`;
}

async function loadAccounts(): Promise<Record<string, StoredAccount>> {
  const raw = await AsyncStorage.getItem("accounts");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, StoredAccount>;
  } catch {
    return {};
  }
}

async function saveAccounts(accounts: Record<string, StoredAccount>): Promise<void> {
  await AsyncStorage.setItem("accounts", JSON.stringify(accounts));
}

async function migrateOldCredentials(
  email: string,
  password: string
): Promise<StoredAccount | "not_found" | "wrong_password"> {
  const raw = await AsyncStorage.getItem("credentials");
  if (!raw) return "not_found";
  try {
    const creds = JSON.parse(raw) as { email?: string; password?: string; name?: string; plate?: string };
    if (!creds.email || creds.email.toLowerCase().trim() !== email) return "not_found";
    if (creds.password !== password) return "wrong_password";
    const passwordHash = await sha256Hex(password);
    const account: StoredAccount = {
      name: creds.name ?? "",
      plate: creds.plate ?? "",
      passwordHash,
    };
    const accounts = await loadAccounts();
    accounts[email] = account;
    await saveAccounts(accounts);
    return account;
  } catch {
    return "not_found";
  }
}

async function makeSessionToken(passwordHash: string, nonce: string): Promise<string> {
  return sha256Hex(passwordHash + ":" + nonce);
}

async function storeSession(email: string, passwordHash: string): Promise<void> {
  const nonceBytes = await ExpoCrypto.getRandomBytesAsync(16);
  const nonce = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const sessionToken = await makeSessionToken(passwordHash, nonce);
  const record: SessionRecord = { email, nonce, sessionToken };
  await AsyncStorage.setItem("session", JSON.stringify(record));
}

async function verifyAndRestoreSession(): Promise<{ profile: UserProfile; trips: Trip[]; serverToken: string | null } | null> {
  const raw = await AsyncStorage.getItem("session");
  if (!raw) return null;
  let session: SessionRecord;
  try {
    session = JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
  const accounts = await loadAccounts();
  const account = accounts[session.email];
  if (!account) return null;
  const expected = await makeSessionToken(account.passwordHash, session.nonce);
  if (expected !== session.sessionToken) {
    await AsyncStorage.removeItem("session");
    return null;
  }
  const profile: UserProfile = { name: account.name, email: session.email, plate: account.plate, companyName: account.companyName, logoUri: account.logoUri, vehicleBrand: account.vehicleBrand, vehicleModel: account.vehicleModel, vehicleYear: account.vehicleYear, vehicleColor: account.vehicleColor, signatureBlock: account.signatureBlock };
  const raw2 = await secureGetItem(session.email, tripsKey(session.email));
  let trips: Trip[] = [];
  if (raw2) {
    try {
      const parsed: Trip[] = JSON.parse(raw2);
      if (parsed.length > 0) trips = parsed;
    } catch {
      // fall back to empty
    }
  }
  const serverToken = await secureGetItem(session.email, serverTokenKey(session.email));
  return { profile, trips, serverToken };
}

function apiTripToLocal(t: ApiTrip): Trip {
  return {
    id: t.id,
    date: t.date,
    startAddr: t.startAddr,
    endAddr: t.endAddr,
    startLat: t.startLat ?? undefined,
    startLon: t.startLon ?? undefined,
    endLat: t.endLat ?? undefined,
    endLon: t.endLon ?? undefined,
    km: t.km,
    dur: t.dur,
    type: t.type,
    edited: t.edited ?? undefined,
    waypoints: t.waypoints && t.waypoints.length > 0 ? t.waypoints : undefined,
  };
}

function tripToApiPayload(t: Trip): ApiTrip {
  return {
    id: t.id,
    date: t.date,
    startAddr: t.startAddr,
    endAddr: t.endAddr,
    startLat: t.startLat,
    startLon: t.startLon,
    endLat: t.endLat,
    endLon: t.endLon,
    km: t.km,
    dur: t.dur,
    type: t.type,
    edited: t.edited ?? undefined,
    waypoints: t.waypoints && t.waypoints.length > 0 ? t.waypoints : undefined,
    // path, waypointSyncPending, and syncPending are client-only; never sent to the server
  };
}

// Maximum acceptable GPS accuracy (meters). Points less accurate than this are discarded.
const MAX_GPS_ACCURACY_M = 30;
// Minimum movement distance (km) to count — filters GPS jitter
const MIN_MOVE_KM = 0.005;

/**
 * Merge local trips with the authoritative server list.
 *
 * Rules:
 * - Server soft-deletions propagate: any local trip whose ID is marked
 *   deleted on the server is removed from the local state.
 * - Server wins on same-ID conflicts: when both sides have a non-deleted
 *   trip with the same ID, the server version is used. Exception: if the
 *   server copy has no waypoints but the local copy does, the local
 *   waypoints are injected into the merged result and returned in
 *   `waypointPatch` so the caller can patch the server.
 * - Local-only trips (ID not present on server at all) are kept locally
 *   and returned in `localOnly` so the caller can upload them.
 */
function mergeTrips(
  localTrips: Trip[],
  serverApiTrips: ApiTrip[]
): { merged: Trip[]; localOnly: Trip[]; waypointPatch: Trip[] } {
  const serverDeletedIds = new Set(serverApiTrips.filter((t) => t.deleted).map((t) => t.id));
  const serverActiveById = new Map(
    serverApiTrips.filter((t) => !t.deleted).map((t) => [t.id, apiTripToLocal(t)])
  );

  const merged: Trip[] = [];
  for (const serverTrip of serverActiveById.values()) {
    merged.push(serverTrip);
  }

  const localOnly: Trip[] = [];
  const waypointPatch: Trip[] = [];
  for (const lt of localTrips) {
    if (serverDeletedIds.has(lt.id)) continue;
    if (!serverActiveById.has(lt.id)) {
      merged.push(lt);
      localOnly.push(lt);
    } else {
      const serverTrip = serverActiveById.get(lt.id)!;
      const idx = merged.findIndex((m) => m.id === lt.id);

      // path is client-only and never sent to/stored on the server.
      // Always restore the local path onto the merged server entry so the
      // breadcrumb polyline survives session restore and server-merge cycles.
      if (lt.path && lt.path.length >= 2 && idx !== -1 && !merged[idx].path) {
        merged[idx] = { ...merged[idx], path: lt.path };
      }

      // Restore local waypoints when the server copy has none, and schedule
      // a server patch so the server eventually catches up.
      if (lt.waypoints && lt.waypoints.length > 0) {
        if (!serverTrip.waypoints || serverTrip.waypoints.length === 0) {
          waypointPatch.push(lt);
          if (idx !== -1) {
            merged[idx] = { ...merged[idx], waypoints: lt.waypoints };
          }
        }
      }
    }
  }

  merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { merged, localOnly, waypointPatch };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [serverToken, setServerToken] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [paused, setPaused] = useState(false);
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [totalPausedMs, setTotalPausedMs] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<"ok" | "denied" | "waiting">("waiting");
  const [livePos, setLivePos] = useState<{ lat: number; lon: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pendingTrip, setPendingTrip] = useState<Trip | null>(null);
  const [pendingTripCoords, setPendingTripCoords] = useState<{ startLat: number; startLon: number; endLat: number; endLon: number } | null>(null);
  const [pendingTripPath, setPendingTripPath] = useState<{ lat: number; lon: number }[] | null>(null);
  const watchRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverTokenRef = useRef<string | null>(null);
  const tripsRef = useRef<Trip[]>([]);
  const activeTripRef = useRef<ActiveTrip | null>(null);
  const [syncRetryingIds, setSyncRetryingIds] = useState<ReadonlySet<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("offline");
  const [isRefreshingAddresses, setIsRefreshingAddresses] = useState(false);
  const lastRetryMsRef = useRef<number>(0);
  const retryBackoffMsRef = useRef<number>(30_000);

  // Tracking preference values — kept in a ref so startTrip/addTrip/editTrip/deleteTrip
  // always read the latest value without needing them in useCallback dependency arrays.
  const trackingPrefsRef = useRef({
    autoTracking: true,
    gpsTracking: true,
    bgTracking: false,
    offlineStorage: true,
  });
  // Reactive copy of gpsTracking so UI components can re-render when it changes.
  const [gpsTrackingPref, setGpsTrackingPref] = useState(true);

  useEffect(() => {
    serverTokenRef.current = serverToken;
  }, [serverToken]);

  // Load tracking prefs from AsyncStorage once on mount
  useEffect(() => {
    AsyncStorage.multiGet([
      "pref_auto_tracking",
      "pref_gps_tracking",
      "pref_bg_tracking",
      "pref_offline_storage",
    ]).then((vals) => {
      const m = Object.fromEntries(vals);
      const gpsTracking = m["pref_gps_tracking"] !== "false";
      trackingPrefsRef.current = {
        autoTracking: m["pref_auto_tracking"] !== "false",
        gpsTracking,
        bgTracking: m["pref_bg_tracking"] === "true",
        offlineStorage: m["pref_offline_storage"] !== "false",
      };
      setGpsTrackingPref(gpsTracking);
    }).catch(() => {});
  }, []);

  const setTrackingPref = useCallback((key: "autoTracking" | "gpsTracking" | "bgTracking" | "offlineStorage", value: boolean) => {
    trackingPrefsRef.current = { ...trackingPrefsRef.current, [key]: value };
    if (key === "gpsTracking") setGpsTrackingPref(value);
  }, []);

  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);

  useEffect(() => {
    verifyAndRestoreSession()
      .then(async (result) => {
        if (result) {
          setUserState(result.profile);
          let finalTrips = result.trips;
          if (result.serverToken) {
            setServerToken(result.serverToken);
            serverTokenRef.current = result.serverToken;
            const serverApiTrips = await fetchServerTrips(result.serverToken);
            if (serverApiTrips !== null) {
              setSyncStatus("synced");
              const { merged, localOnly, waypointPatch } = mergeTrips(result.trips, serverApiTrips);
              finalTrips = merged;
              if (localOnly.length > 0) {
                serverBatchUpsertTrips(result.serverToken, localOnly.map(tripToApiPayload)).then((ok) => {
                  if (ok) {
                    const upsertedIds = new Set(localOnly.map((t) => t.id));
                    setTrips((prev) => {
                      const next = prev.map((t) => {
                        if (!upsertedIds.has(t.id) || !t.syncPending) return t;
                        const { syncPending: _sp, waypointSyncPending: _wp, ...rest } = t;
                        return rest;
                      });
                      setUserState((u) => {
                        if (u) persistTripsLocal(next, u.email);
                        return u;
                      });
                      return next;
                    });
                  }
                });
              } else if (serverApiTrips.filter((t) => !t.deleted).length === 0 && result.trips.length > 0) {
                serverBatchUpsertTrips(result.serverToken, result.trips.map(tripToApiPayload));
              }
              if (waypointPatch.length > 0) {
                const patchIds = new Set(waypointPatch.map((t) => t.id));
                finalTrips = finalTrips.map((t) =>
                  patchIds.has(t.id) && t.waypoints && t.waypoints.length > 0
                    ? { ...t, waypointSyncPending: true }
                    : t
                );
                for (const t of waypointPatch) {
                  serverUpdateTrip(result.serverToken, t.id, { waypoints: t.waypoints }).then((ok) => {
                    if (ok) {
                      setTrips((prev) => {
                        const next = prev.map((tr) =>
                          tr.id === t.id ? { ...tr, waypointSyncPending: false } : tr
                        );
                        setUserState((u) => {
                          if (u) persistTripsLocal(next, u.email);
                          return u;
                        });
                        return next;
                      });
                    }
                  });
                }
              }
            }
          }
          setTrips(finalTrips);
          persistTripsLocal(finalTrips, result.profile.email);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  useEffect(() => {
    if (activeTrip) {
      tickRef.current = setInterval(() => {
        if (!paused) {
          let pMs = totalPausedMs;
          if (pauseStartedAt) pMs += Date.now() - pauseStartedAt;
          setElapsed(Math.max(0, Math.floor((Date.now() - activeTrip.startTime - pMs) / 1000)));
        }
      }, 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      setElapsed(0);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [activeTrip, paused, pauseStartedAt, totalPausedMs]);

  // Lock-screen notification: show when trip active, update every 60s, hide when done
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!activeTrip) {
      hideTripNotification().catch(() => {});
      return;
    }
    setupTripNotificationChannel().catch(() => {});
    const showNow = () => {
      const t = activeTripRef.current;
      if (!t) return;
      const sec = Math.max(0, Math.floor((Date.now() - t.startTime) / 1000));
      const km = (t.distance || 0) / 1000;
      showTripNotification(t.type, sec, km).catch(() => {});
    };
    showNow();
    const id = setInterval(showNow, 60_000);
    return () => {
      clearInterval(id);
      hideTripNotification().catch(() => {});
    };
  }, [activeTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteAccount = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const token = serverTokenRef.current;
    if (token) {
      const ok = await serverDeleteAccount(token);
      if (!ok) {
        return { success: false, error: "Konto konnte nicht gelöscht werden. Bitte versuche es erneut." };
      }
    }
    // Wipe all local data identically to logout
    const email = user?.email ?? null;
    if (watchRef.current !== null) {
      if (Platform.OS !== "web") {
        (watchRef.current as unknown as { remove: () => void })?.remove?.();
      } else {
        navigator.geolocation?.clearWatch(watchRef.current);
      }
      watchRef.current = null;
    }
    if (Platform.OS !== "web") {
      try {
        const Location = await import("expo-location");
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      } catch { /* non-fatal */ }
    }
    setUserState(null);
    setActiveTrip(null);
    setTrips([]);
    setServerToken(null);
    serverTokenRef.current = null;
    setSyncStatus("offline");
    const removals: Promise<void>[] = [
      AsyncStorage.removeItem("session"),
      AsyncStorage.removeItem(BG_POSITIONS_KEY),
    ];
    if (email) {
      removals.push(AsyncStorage.removeItem(tripsKey(email)));
      removals.push(AsyncStorage.removeItem(serverTokenKey(email)));
      removals.push(secureRemoveDataKey(email));
      removals.push(
        loadAccounts().then((accounts) => {
          delete accounts[email];
          return saveAccounts(accounts);
        })
      );
    }
    await Promise.all(removals);
    return { success: true };
  }, [user]);

  const logout = useCallback(async () => {
    const email = user?.email ?? null;

    // Stop foreground GPS watch
    if (watchRef.current !== null) {
      if (Platform.OS !== "web") {
        (watchRef.current as unknown as { remove: () => void })?.remove?.();
      } else {
        navigator.geolocation?.clearWatch(watchRef.current);
      }
      watchRef.current = null;
    }

    // Stop background location tasks (native only)
    if (Platform.OS !== "web") {
      try {
        const Location = await import("expo-location");
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
        const isDetecting = await Location.hasStartedLocationUpdatesAsync(DRIVE_DETECT_TASK);
        if (isDetecting) {
          await Location.stopLocationUpdatesAsync(DRIVE_DETECT_TASK);
        }
      } catch {
        // Non-fatal
      }
    }

    setUserState(null);
    setActiveTrip(null);
    setTrips([]);
    setServerToken(null);
    serverTokenRef.current = null;
    setSyncStatus("offline");

    const removals: Promise<void>[] = [
      AsyncStorage.removeItem("session"),
      AsyncStorage.removeItem(BG_POSITIONS_KEY),
      AsyncStorage.setItem(DRIVE_TRIP_ACTIVE_KEY, "false"),
    ];
    if (email) {
      removals.push(AsyncStorage.removeItem(tripsKey(email)));
      removals.push(AsyncStorage.removeItem(serverTokenKey(email)));
      removals.push(secureRemoveDataKey(email));
      removals.push(
        loadAccounts().then((accounts) => {
          delete accounts[email];
          return saveAccounts(accounts);
        })
      );
    }
    await Promise.all(removals);
  }, [user]);

  const persistTripsLocal = useCallback((next: Trip[], email: string) => {
    secureSetItem(email, tripsKey(email), JSON.stringify(next));
  }, []);

  // Returns true when the address string already contains a house number.
  // Heuristic: the street segment (before the first comma) contains a digit.
  function hasHouseNumber(addr: string): boolean {
    if (!addr) return false;
    const street = addr.split(",")[0] ?? addr;
    return /\d/.test(street);
  }

  // True when the address is a raw coordinate fallback (e.g. "52.1234°, 13.4567°")
  // — these should always be replaced with whatever Nominatim returns.
  function isRawCoordinates(addr: string): boolean {
    if (!addr) return true;
    return /^\d+\.\d+°/.test(addr.trim());
  }

  // True when the new address is meaningfully better than the current one.
  // Accepts the update if: new address has a house number, OR current was raw coords/empty.
  function isBetterAddress(current: string | undefined, next: string): boolean {
    if (!next || isRawCoordinates(next)) return false; // never replace with coordinates
    if (!current || isRawCoordinates(current)) return true; // any real address > raw coords
    return hasHouseNumber(next) && !hasHouseNumber(current); // street+number > street only
  }

  const refreshAddresses = useCallback(async () => {
    if (!user) return;
    setIsRefreshingAddresses(true);
    try {
      const current = tripsRef.current;
      const updates: { id: string; startAddr?: string; endAddr?: string }[] = [];

      for (const trip of current) {
        const needsStart =
          trip.startLat !== undefined &&
          trip.startLon !== undefined &&
          (isRawCoordinates(trip.startAddr) || !hasHouseNumber(trip.startAddr));
        const needsEnd =
          trip.endLat !== undefined &&
          trip.endLon !== undefined &&
          (isRawCoordinates(trip.endAddr) || !hasHouseNumber(trip.endAddr));

        if (!needsStart && !needsEnd) continue;

        const update: { id: string; startAddr?: string; endAddr?: string } = { id: trip.id };

        if (needsStart) {
          const addr = await reverseGeocode(trip.startLat!, trip.startLon!);
          if (isBetterAddress(trip.startAddr, addr)) update.startAddr = addr;
          await new Promise<void>((r) => setTimeout(r, 1100));
        }
        if (needsEnd) {
          const addr = await reverseGeocode(trip.endLat!, trip.endLon!);
          if (isBetterAddress(trip.endAddr, addr)) update.endAddr = addr;
          await new Promise<void>((r) => setTimeout(r, 1100));
        }

        if (update.startAddr !== undefined || update.endAddr !== undefined) {
          updates.push(update);
        }
      }

      if (updates.length === 0) return;

      setTrips((prev) => {
        const next = prev.map((t) => {
          const u = updates.find((upd) => upd.id === t.id);
          if (!u) return t;
          return {
            ...t,
            ...(u.startAddr !== undefined ? { startAddr: u.startAddr } : {}),
            ...(u.endAddr !== undefined ? { endAddr: u.endAddr } : {}),
          };
        });
        setUserState((u) => {
          if (u) persistTripsLocal(next, u.email);
          return u;
        });
        return next;
      });

      const token = serverTokenRef.current;
      if (token && trackingPrefsRef.current.offlineStorage) {
        for (const u of updates) {
          const changes: Partial<ApiTrip> = {};
          if (u.startAddr !== undefined) changes.startAddr = u.startAddr;
          if (u.endAddr !== undefined) changes.endAddr = u.endAddr;
          serverUpdateTrip(token, u.id, changes);
        }
      }
    } finally {
      setIsRefreshingAddresses(false);
    }
  }, [user, persistTripsLocal]);

  // Auto-trigger address refresh on the first startup after loading completes.
  // Fire-and-forget: runs silently in the background, no UI blocked.
  const autoRefreshDoneRef = useRef(false);
  // Tracks whether the one-time coord backfill has already been scheduled.
  const autoBackfillDoneRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (autoRefreshDoneRef.current) return;
    if (!user) return;
    autoRefreshDoneRef.current = true;
    const tid = setTimeout(() => {
      refreshAddresses().catch(() => {});
    }, 3000);
    return () => clearTimeout(tid);
  }, [loading, user, refreshAddresses]);

  const runPendingRetry = useCallback((bypassBackoff = false) => {
    const token = serverTokenRef.current;
    if (!token) return;
    if (!trackingPrefsRef.current.offlineStorage) return;
    const now = Date.now();
    if (!bypassBackoff && now - lastRetryMsRef.current < retryBackoffMsRef.current) return;

    const allTrips = tripsRef.current;

    // Trips whose full create/update never reached the server
    const syncPendingCreate = allTrips.filter((t) => t.syncPending === "create");
    const syncPendingUpdate = allTrips.filter((t) => t.syncPending === "update");

    // Trips that exist on the server but whose waypoints are still pending
    // (exclude trips with syncPending — they haven't been created yet, so
    //  a waypoint-only update would fail with 404)
    const waypointPending = allTrips.filter(
      (t) => t.waypointSyncPending && !t.syncPending && t.waypoints && t.waypoints.length > 0
    );

    const hasPending =
      syncPendingCreate.length > 0 ||
      syncPendingUpdate.length > 0 ||
      waypointPending.length > 0;

    if (!hasPending) {
      retryBackoffMsRef.current = 30_000;
      return;
    }

    lastRetryMsRef.current = now;

    const allPendingIds = new Set([
      ...syncPendingCreate.map((t) => t.id),
      ...syncPendingUpdate.map((t) => t.id),
      ...waypointPending.map((t) => t.id),
    ]);
    setSyncRetryingIds(allPendingIds);

    Promise.all([
      ...syncPendingCreate.map((t) =>
        serverCreateTrip(token, tripToApiPayload(t)).then((ok) => ({
          id: t.id,
          ok,
          kind: "create" as const,
          hasWaypoints: !!(t.waypoints && t.waypoints.length > 0),
        }))
      ),
      ...syncPendingUpdate.map((t) =>
        serverUpdateTrip(token, t.id, tripToApiPayload(t)).then((ok) => ({
          id: t.id,
          ok,
          kind: "update" as const,
          hasWaypoints: false,
        }))
      ),
      ...waypointPending.map((t) =>
        serverUpdateTrip(token, t.id, { waypoints: t.waypoints }).then((ok) => ({
          id: t.id,
          ok,
          kind: "waypoint" as const,
          hasWaypoints: false,
        }))
      ),
    ]).then((results) => {
      setSyncRetryingIds(new Set());

      const allOk = results.every((r) => r.ok);
      retryBackoffMsRef.current = allOk
        ? 30_000
        : Math.min(retryBackoffMsRef.current * 2, 300_000);

      const succeeded = results.filter((r) => r.ok);
      if (succeeded.length > 0) {
        const createdIds = new Set(
          succeeded.filter((r) => r.kind === "create").map((r) => r.id)
        );
        const updatedIds = new Set(
          succeeded.filter((r) => r.kind === "update").map((r) => r.id)
        );
        const waypointIds = new Set(
          succeeded.filter((r) => r.kind === "waypoint").map((r) => r.id)
        );

        setTrips((prev) => {
          const next = prev.map((t) => {
            if (createdIds.has(t.id)) {
              // Full create succeeded — clear both syncPending and waypointSyncPending
              const { syncPending: _sp, waypointSyncPending: _wp, ...rest } = t;
              return rest;
            }
            if (updatedIds.has(t.id)) {
              const { syncPending: _sp, ...rest } = t;
              return rest;
            }
            if (waypointIds.has(t.id)) {
              return { ...t, waypointSyncPending: false };
            }
            return t;
          });
          setUserState((u) => {
            if (u) persistTripsLocal(next, u.email);
            return u;
          });
          return next;
        });
      }
    });
  }, [persistTripsLocal]);

  useEffect(() => {
    const handleAppStateChange = (nextState: string) => {
      if (nextState !== "active") return;
      runPendingRetry();
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [runPendingRetry]);

  const prevIsConnectedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      const wasConnected = prevIsConnectedRef.current;
      prevIsConnectedRef.current = isConnected;

      if (isConnected && wasConnected === false) {
        retryBackoffMsRef.current = 30_000;
        lastRetryMsRef.current = 0;
        runPendingRetry(true);
      }
    });

    return () => unsubscribe();
  }, [runPendingRetry]);

  const applyServerAuth = useCallback(async (
    email: string,
    token: string,
    localTrips: Trip[]
  ): Promise<Trip[]> => {
    await secureSetItem(email, serverTokenKey(email), token);
    setServerToken(token);
    serverTokenRef.current = token;
    const serverApiTrips = await fetchServerTrips(token);
    if (serverApiTrips !== null) {
      setSyncStatus("synced");
      const { merged, localOnly, waypointPatch } = mergeTrips(localTrips, serverApiTrips);
      let result = merged;
      if (localOnly.length > 0) {
        const upsertOk = await serverBatchUpsertTrips(token, localOnly.map(tripToApiPayload));
        if (upsertOk) {
          const upsertedIds = new Set(localOnly.map((t) => t.id));
          result = result.map((t) => {
            if (!upsertedIds.has(t.id) || !t.syncPending) return t;
            const { syncPending: _sp, waypointSyncPending: _wp, ...rest } = t;
            return rest;
          });
        }
      } else if (serverApiTrips.filter((t) => !t.deleted).length === 0 && localTrips.length > 0) {
        await serverBatchUpsertTrips(token, localTrips.map(tripToApiPayload));
      }
      if (waypointPatch.length > 0) {
        const patchIds = new Set(waypointPatch.map((t) => t.id));
        result = result.map((t) =>
          patchIds.has(t.id) && t.waypoints && t.waypoints.length > 0
            ? { ...t, waypointSyncPending: true }
            : t
        );
        const patchResults = await Promise.all(
          waypointPatch.map((t) => serverUpdateTrip(token, t.id, { waypoints: t.waypoints }).then((ok) => ({ id: t.id, ok })))
        );
        for (const { id, ok } of patchResults) {
          if (ok) {
            result = result.map((t) => (t.id === id ? { ...t, waypointSyncPending: false } : t));
          }
        }
      }
      return result;
    }
    return localTrips;
  }, []);

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<"ok" | "not_found" | "wrong_password" | "server_unavailable"> => {
    const key = email.toLowerCase().trim();
    const accounts = await loadAccounts();
    let account = accounts[key];

    if (!account) {
      const migrated = await migrateOldCredentials(key, password);
      if (migrated === "wrong_password") return "wrong_password";
      if (migrated !== "not_found") {
        account = migrated;
      } else {
        // No local account — try server login to support cross-device sync
        const serverResult = await serverLogin(key, password);
        if (serverResult === "network_error") return "server_unavailable";
        if (!serverResult) return "not_found";

        // Server auth succeeded: reconstruct local account from server profile
        const passwordHash = await sha256Hex(password);
        const newAccount: StoredAccount = { name: serverResult.name, plate: serverResult.plate, passwordHash };
        accounts[key] = newAccount;
        await saveAccounts(accounts);
        await storeSession(key, passwordHash);

        // Store server token and fetch trips
        await secureSetItem(key, serverTokenKey(key), serverResult.token);
        setServerToken(serverResult.token);
        serverTokenRef.current = serverResult.token;

        const serverApiTrips = await fetchServerTrips(serverResult.token);
        let finalTrips: Trip[];
        if (serverApiTrips !== null && serverApiTrips.filter((t) => !t.deleted).length > 0) {
          const { merged } = mergeTrips([], serverApiTrips);
          finalTrips = merged;
        } else {
          finalTrips = [];
        }
        setSyncStatus("synced");

        const profile: UserProfile = { name: serverResult.name, email: key, plate: serverResult.plate };
        setUserState(profile);
        setTrips(finalTrips);
        persistTripsLocal(finalTrips, key);
        return "ok";
      }
    }

    const hash = await sha256Hex(password);
    if (hash !== account.passwordHash) return "wrong_password";
    await storeSession(key, account.passwordHash);
    const profile: UserProfile = { name: account.name, email: key, plate: account.plate, companyName: account.companyName, logoUri: account.logoUri, vehicleBrand: account.vehicleBrand, vehicleModel: account.vehicleModel, vehicleYear: account.vehicleYear, vehicleColor: account.vehicleColor, signatureBlock: account.signatureBlock };
    setUserState(profile);

    const raw = await secureGetItem(key, tripsKey(key));
    let localTrips: Trip[] = [];
    if (raw) {
      try {
        const parsed: Trip[] = JSON.parse(raw);
        if (parsed.length > 0) localTrips = parsed;
      } catch {
        // fall back to empty
      }
    } else {
      const oldTrips = await AsyncStorage.getItem("trips");
      if (oldTrips) {
        try {
          const parsed: Trip[] = JSON.parse(oldTrips);
          if (parsed.length > 0) {
            localTrips = parsed;
            await secureSetItem(key, tripsKey(key), JSON.stringify(parsed));
          }
        } catch {
          // fall back to empty
        }
      }
    }

    // Sync with server: try login first, then register if not found
    let token: string | null = null;
    const loginResult = await serverLogin(key, password);
    if (loginResult && loginResult !== "network_error") {
      token = loginResult.token;
    } else if (!loginResult) {
      const registered = await serverRegister(key, account.name, account.plate, password);
      if (registered) {
        const loginAfterRegister = await serverLogin(key, password);
        if (loginAfterRegister && loginAfterRegister !== "network_error") {
          token = loginAfterRegister.token;
        }
      }
    }

    let finalTrips = localTrips;
    if (token) {
      await secureSetItem(key, serverTokenKey(key), token);
      setServerToken(token);
      serverTokenRef.current = token;
      setSyncStatus("synced");
      const { merged, localOnly, waypointPatch } = mergeTrips(localTrips, await fetchServerTrips(token) || []);
      let patchedMerged = merged;
      if (localOnly.length > 0) {
        const upsertOk = await serverBatchUpsertTrips(token, localOnly.map(tripToApiPayload));
        if (upsertOk) {
          const upsertedIds = new Set(localOnly.map((t) => t.id));
          patchedMerged = patchedMerged.map((t) => {
            if (!upsertedIds.has(t.id) || !t.syncPending) return t;
            const { syncPending: _sp, waypointSyncPending: _wp, ...rest } = t;
            return rest;
          });
        }
      }
      if (waypointPatch.length > 0) {
        const patchIds = new Set(waypointPatch.map((t) => t.id));
        patchedMerged = patchedMerged.map((t) =>
          patchIds.has(t.id) && t.waypoints && t.waypoints.length > 0
            ? { ...t, waypointSyncPending: true }
            : t
        );
        const patchResults = await Promise.all(
          waypointPatch.map((t) => serverUpdateTrip(token, t.id, { waypoints: t.waypoints }).then((ok) => ({ id: t.id, ok })))
        );
        for (const { id, ok } of patchResults) {
          if (ok) {
            patchedMerged = patchedMerged.map((t) => (t.id === id ? { ...t, waypointSyncPending: false } : t));
          }
        }
      }
      finalTrips = patchedMerged;
    }

    setTrips(finalTrips);
    persistTripsLocal(finalTrips, key);
    return "ok";
  }, [persistTripsLocal]);

  const biometricLogin = useCallback(async (): Promise<"ok" | "no_session"> => {
    const result = await verifyAndRestoreSession();
    if (!result) return "no_session";
    setUserState(result.profile);
    let finalTrips = result.trips;
    if (result.serverToken) {
      setServerToken(result.serverToken);
      serverTokenRef.current = result.serverToken;
      const serverApiTrips = await fetchServerTrips(result.serverToken);
      if (serverApiTrips !== null) {
        setSyncStatus("synced");
        const { merged, localOnly } = mergeTrips(result.trips, serverApiTrips);
        finalTrips = merged;
        if (localOnly.length > 0) {
          serverBatchUpsertTrips(result.serverToken, localOnly.map(tripToApiPayload)).then((ok) => {
            if (ok) {
              const upsertedIds = new Set(localOnly.map((t) => t.id));
              setTrips((prev) => {
                const next = prev.map((t) => {
                  if (!upsertedIds.has(t.id) || !t.syncPending) return t;
                  const { syncPending: _sp, waypointSyncPending: _wp, ...rest } = t;
                  return rest;
                });
                setUserState((u) => {
                  if (u) persistTripsLocal(next, u.email);
                  return u;
                });
                return next;
              });
            }
          });
        }
      }
    }
    setTrips(finalTrips);
    persistTripsLocal(finalTrips, result.profile.email);
    return "ok";
  }, [persistTripsLocal]);

  const register = useCallback(async (
    name: string,
    email: string,
    plate: string,
    password: string
  ): Promise<"ok" | "exists"> => {
    const key = email.toLowerCase().trim();
    const accounts = await loadAccounts();
    if (accounts[key]) return "exists";
    const passwordHash = await sha256Hex(password);
    accounts[key] = { name, plate, passwordHash };
    await saveAccounts(accounts);
    await storeSession(key, passwordHash);
    const profile: UserProfile = { name, email: key, plate };
    setUserState(profile);
    await secureSetItem(key, tripsKey(key), JSON.stringify([]));
    setTrips([]);

    // Register on server, then login to obtain a session token
    const registered = await serverRegister(key, name, plate, password);
    if (registered) {
      const loginResult = await serverLogin(key, password);
      if (loginResult && loginResult !== "network_error") {
        await secureSetItem(key, serverTokenKey(key), loginResult.token);
        setServerToken(loginResult.token);
        serverTokenRef.current = loginResult.token;
        setSyncStatus("synced");
      }
    }

    return "ok";
  }, []);

  const updateProfile = useCallback(async (name: string, plate: string) => {
    if (!user) return;
    const accounts = await loadAccounts();
    if (!accounts[user.email]) {
      accounts[user.email] = { name, plate, passwordHash: "" };
    } else {
      accounts[user.email].name = name;
      accounts[user.email].plate = plate;
    }
    await saveAccounts(accounts);
    setUserState((u) => u ? { ...u, name, plate } : u);
  }, [user]);

  const updateCompanyInfo = useCallback(async (companyName: string, logoUri: string, signatureBlock?: boolean) => {
    if (!user) return;
    const accounts = await loadAccounts();
    if (!accounts[user.email]) {
      accounts[user.email] = { name: user.name ?? "", plate: user.plate ?? "", passwordHash: "", companyName, logoUri, signatureBlock };
    } else {
      accounts[user.email].companyName = companyName;
      accounts[user.email].logoUri = logoUri;
      if (signatureBlock !== undefined) accounts[user.email].signatureBlock = signatureBlock;
    }
    await saveAccounts(accounts);
    setUserState((u) => u ? { ...u, companyName, logoUri, ...(signatureBlock !== undefined ? { signatureBlock } : {}) } : u);
  }, [user]);

  const updateVehicleData = useCallback(async (brand: string, model: string, year: string, color: string) => {
    if (!user) return;
    const accounts = await loadAccounts();
    if (!accounts[user.email]) {
      accounts[user.email] = { name: user.name ?? "", plate: user.plate ?? "", passwordHash: "", vehicleBrand: brand, vehicleModel: model, vehicleYear: year, vehicleColor: color };
    } else {
      accounts[user.email].vehicleBrand = brand;
      accounts[user.email].vehicleModel = model;
      accounts[user.email].vehicleYear = year;
      accounts[user.email].vehicleColor = color;
    }
    await saveAccounts(accounts);
    setUserState((u) => u ? { ...u, vehicleBrand: brand, vehicleModel: model, vehicleYear: year, vehicleColor: color } : u);
  }, [user]);

  const updatePassword = useCallback(async (email: string, newPassword: string) => {
    const key = email.toLowerCase().trim();
    const accounts = await loadAccounts();
    if (!accounts[key]) return;
    const passwordHash = await sha256Hex(newPassword);
    accounts[key].passwordHash = passwordHash;
    await saveAccounts(accounts);
    await storeSession(key, passwordHash);

    // Re-login to get a fresh server token — the old one was revoked when the
    // password was reset on the server.
    try {
      const loginResult = await serverLogin(key, newPassword);
      if (loginResult && loginResult !== "network_error") {
        await secureSetItem(key, serverTokenKey(key), loginResult.token);
        setServerToken(loginResult.token);
        serverTokenRef.current = loginResult.token;
      }
    } catch {
      // Offline fallback — local session is valid; sync resumes on next login
    }
  }, []);

  const requestPasswordChangeCode = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const token = serverTokenRef.current;
    if (!token) return { success: false, error: "Nicht mit Server verbunden. Bitte zuerst anmelden." };
    return serverRequestChangeCode(token);
  }, []);

  const requestEmailChangeCode = useCallback(async (newEmail: string): Promise<{ success: boolean; error?: string }> => {
    const token = serverTokenRef.current;
    if (!token) return { success: false, error: "Nicht mit Server verbunden. Bitte zuerst anmelden." };
    return serverRequestEmailChangeCode(token, newEmail);
  }, []);

  const confirmEmailChange = useCallback(async (code: string, newEmail: string): Promise<{ success: boolean; error?: string }> => {
    const token = serverTokenRef.current;
    if (!token) return { success: false, error: "Nicht mit Server verbunden." };
    return serverConfirmEmailChange(token, code, newEmail);
  }, []);

  const confirmPasswordChange = useCallback(async (code: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const token = serverTokenRef.current;
    if (!token) return { success: false, error: "Nicht mit Server verbunden." };
    const result = await serverConfirmChangePassword(token, code, newPassword);
    if (result.success && user) {
      const key = user.email.toLowerCase().trim();
      const accounts = await loadAccounts();
      if (accounts[key]) {
        const passwordHash = await sha256Hex(newPassword);
        accounts[key].passwordHash = passwordHash;
        await saveAccounts(accounts);
        await storeSession(key, passwordHash);
      }

      // The server revoked all sessions on password change — get a fresh token
      // so sync continues without the user having to log out and back in.
      try {
        const loginResult = await serverLogin(key, newPassword);
        if (loginResult && loginResult !== "network_error") {
          await secureSetItem(key, serverTokenKey(key), loginResult.token);
          setServerToken(loginResult.token);
          serverTokenRef.current = loginResult.token;
        }
      } catch {
        // Offline fallback — sync resumes on next app launch
      }
    }
    return result;
  }, [user]);

  const addTrip = useCallback(async (t: Trip) => {
    const token = serverTokenRef.current;
    const hasWaypoints = !!(t.waypoints && t.waypoints.length > 0);
    // Mark waypoints as pending sync when the trip has waypoints and we're connected
    const tripToStore: Trip = token && hasWaypoints ? { ...t, waypointSyncPending: true } : t;
    setTrips((prev) => {
      const next = [tripToStore, ...prev];
      setUserState((u) => {
        if (u) persistTripsLocal(next, u.email);
        return u;
      });
      return next;
    });
    if (token && trackingPrefsRef.current.offlineStorage) {
      setSyncStatus("syncing");
      serverCreateTrip(token, tripToApiPayload(t)).then((ok) => {
        setSyncStatus(ok ? "synced" : "offline");
        if (ok) {
          // Server confirmed the full trip (including any waypoints) — clear all pending flags
          setTrips((prev) => {
            const next = prev.map((tr) => {
              if (tr.id !== t.id) return tr;
              const { syncPending: _sp, waypointSyncPending: _wp, ...rest } = tr;
              return rest;
            });
            setUserState((u) => {
              if (u) persistTripsLocal(next, u.email);
              return u;
            });
            return next;
          });
        } else {
          // Create failed (offline or server error) — mark the trip so
          // runPendingRetry will re-send it on reconnect / app-active
          setTrips((prev) => {
            const next = prev.map((tr) =>
              tr.id === t.id
                ? { ...tr, syncPending: "create" as const, waypointSyncPending: false }
                : tr
            );
            setUserState((u) => {
              if (u) persistTripsLocal(next, u.email);
              return u;
            });
            return next;
          });
        }
      });
    }
  }, [persistTripsLocal]);

  const finalizeTrip = useCallback(async (trip: Trip) => {
    setPendingTrip(null);
    setPendingTripCoords(null);
    setPendingTripPath(null);
    await addTrip(trip);
  }, [addTrip]);

  const discardPendingTrip = useCallback(() => {
    setPendingTrip(null);
    setPendingTripCoords(null);
    setPendingTripPath(null);
  }, []);

  const deleteTrip = useCallback(async (id: string) => {
    setTrips((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setUserState((u) => {
        if (u) persistTripsLocal(next, u.email);
        return u;
      });
      return next;
    });
    const token = serverTokenRef.current;
    if (token && trackingPrefsRef.current.offlineStorage) {
      setSyncStatus("syncing");
      serverDeleteTrip(token, id).then((ok) => {
        setSyncStatus(ok ? "synced" : "offline");
      });
    }
  }, [persistTripsLocal]);

  const editTrip = useCallback((id: string, changes: Partial<Trip>) => {
    // When an address is changed to a *different* value without accompanying
    // new coordinates, the stored GPS coords are stale. Compare against the
    // current trip (via tripsRef so we always read the latest value) before
    // deciding to clear. This avoids wiping coords on edits that happen to
    // pass the same address string unchanged (e.g. the edit modal always
    // includes both address fields even when only km/dur/type was edited).
    const existing = tripsRef.current.find((t) => t.id === id);

    const clearStart =
      existing != null &&
      'startAddr' in changes &&
      changes.startAddr !== existing.startAddr &&
      changes.startLat === undefined &&
      changes.startLon === undefined;

    const clearEnd =
      existing != null &&
      'endAddr' in changes &&
      changes.endAddr !== existing.endAddr &&
      changes.endLat === undefined &&
      changes.endLon === undefined;

    const serverChanges: Partial<ApiTrip> = { ...changes };
    if (clearStart) { serverChanges.startLat = null; serverChanges.startLon = null; }
    if (clearEnd) { serverChanges.endLat = null; serverChanges.endLon = null; }

    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...changes };
        // Remove stale coord keys so they are truly absent in local state.
        if (clearStart) { delete updated.startLat; delete updated.startLon; }
        if (clearEnd) { delete updated.endLat; delete updated.endLon; }
        return updated;
      });
      setUserState((u) => {
        if (u) persistTripsLocal(next, u.email);
        return u;
      });
      return next;
    });
    const token = serverTokenRef.current;
    if (token && trackingPrefsRef.current.offlineStorage) {
      setSyncStatus("syncing");
      serverUpdateTrip(token, id, serverChanges).then((ok) => {
        setSyncStatus(ok ? "synced" : "offline");
        if (!ok) {
          // Update failed — mark the trip for retry on reconnect / app-active.
          // Keep existing syncPending: "create" if the trip was never created;
          // otherwise set "update" so runPendingRetry sends the full current state.
          setTrips((prev) => {
            const next = prev.map((t) => {
              if (t.id !== id) return t;
              if (t.syncPending === "create") return t;
              return { ...t, syncPending: "update" as const };
            });
            setUserState((u) => {
              if (u) persistTripsLocal(next, u.email);
              return u;
            });
            return next;
          });
        }
      });
    }
  }, [persistTripsLocal]);

  const retryWaypointSync = useCallback(async (id: string): Promise<boolean> => {
    const token = serverTokenRef.current;
    if (!token) return false;
    if (!trackingPrefsRef.current.offlineStorage) return false;
    const trip = trips.find((t) => t.id === id);
    if (!trip || !trip.waypoints || trip.waypoints.length === 0) return false;
    const ok = await serverUpdateTrip(token, id, { waypoints: trip.waypoints });
    if (ok) {
      setTrips((prev) => {
        const next = prev.map((t) =>
          t.id === id ? { ...t, waypointSyncPending: false } : t
        );
        setUserState((u) => {
          if (u) persistTripsLocal(next, u.email);
          return u;
        });
        return next;
      });
    }
    return ok;
  }, [trips, persistTripsLocal]);

  const startTrip = useCallback(
    async (type: "business" | "private", startAddrOverride?: string) => {
      setGpsStatus("waiting");
      clearDriveDetectStopped().catch(() => {});
      const tripId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      const beginTracking = (lat: number, lon: number) => {
        setLivePos({ lat, lon });
        setGpsStatus("ok");
        setActiveTrip({
          id: tripId,
          startTime: Date.now(),
          type,
          startAddr: startAddrOverride ?? "",
          distance: 0,
          positions: [{ lat, lon }],
        });
        AsyncStorage.setItem(DRIVE_TRIP_ACTIVE_KEY, "true").catch(() => {});
        if (!startAddrOverride) {
          reverseGeocode(lat, lon).then((addr) => {
            setActiveTrip((prev) =>
              prev ? { ...prev, startAddr: addr } : prev
            );
          });
        }
      };

      if (Platform.OS === "web") {
        navigator.geolocation?.getCurrentPosition(
          (pos) => beginTracking(pos.coords.latitude, pos.coords.longitude),
          () => {
            setGpsStatus("denied");
            beginTracking(52.52, 13.405);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
        navigator.geolocation?.watchPosition(
          (pos) => {
            if (pos.coords.accuracy > MAX_GPS_ACCURACY_M) return;
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            setLivePos({ lat, lon });
            setActiveTrip((prev) => {
              if (!prev) return prev;
              const last = prev.positions[prev.positions.length - 1];
              const d = haversine(last.lat, last.lon, lat, lon);
              if (d < MIN_MOVE_KM) return prev;
              return {
                ...prev,
                distance: prev.distance + d,
                positions: [...prev.positions, { lat, lon }],
              };
            });
          },
          undefined,
          { enableHighAccuracy: true, maximumAge: 0 }
        );
      } else {
        const { gpsTracking, bgTracking } = trackingPrefsRef.current;

        if (!gpsTracking) {
          // GPS tracking disabled by user — start trip without location data
          setGpsStatus("denied");
          setActiveTrip({
            id: tripId,
            startTime: Date.now(),
            type,
            startAddr: "",
            distance: 0,
            positions: [],
          });
          AsyncStorage.setItem(DRIVE_TRIP_ACTIVE_KEY, "true").catch(() => {});
          return;
        }

        const Location = await import("expo-location");

        // 1. Foreground permission
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== "granted") {
          setGpsStatus("denied");
          beginTracking(52.52, 13.405);
          return;
        }

        // 2. Background permission (best-effort — only when background tracking enabled)
        if (bgTracking) {
          try {
            await Location.requestBackgroundPermissionsAsync();
          } catch {
            // Permission may not be available in Expo Go — continue with foreground only
          }
        }

        // 3. High-accuracy initial fix
        try {
          const initial = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          beginTracking(initial.coords.latitude, initial.coords.longitude);
        } catch {
          // Location services may be disabled at OS level — fall back gracefully
          setGpsStatus("denied");
          beginTracking(52.52, 13.405);
        }

        // 4. Clear background position store for this new trip
        await AsyncStorage.removeItem(BG_POSITIONS_KEY);

        // 5. Start background location task (only when background tracking enabled)
        if (bgTracking) {
          try {
            const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            if (!alreadyRunning) {
              await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: 2000,
                distanceInterval: 5,
                foregroundService: {
                  notificationTitle: "FahrtDoc",
                  notificationBody: "Fahrt wird aufgezeichnet …",
                  notificationColor: "#0070D8",
                },
                pausesUpdatesAutomatically: false,
                showsBackgroundLocationIndicator: true,
                activityType: Location.ActivityType.AutomotiveNavigation,
              });
            }
          } catch {
            // Falls back gracefully if background task can't start (Expo Go limitation)
          }
        }

        // 6. Foreground watch — keeps React state & live banner updated
        try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            // Discard readings with poor accuracy
            if (loc.coords.accuracy !== null && loc.coords.accuracy > MAX_GPS_ACCURACY_M) return;
            const lat = loc.coords.latitude;
            const lon = loc.coords.longitude;
            setLivePos({ lat, lon });
            setActiveTrip((prev) => {
              if (!prev) return prev;
              const last = prev.positions[prev.positions.length - 1];
              const d = haversine(last.lat, last.lon, lat, lon);
              // Ignore sub-5m jitter
              if (d < MIN_MOVE_KM) return prev;
              return {
                ...prev,
                distance: prev.distance + d,
                positions: [...prev.positions, { lat, lon }],
              };
            });
          }
        );
        watchRef.current = sub as unknown as number;
        } catch {
          // Foreground watch could not start — initial fix already recorded
        }
      }
    },
    []
  );

  const setActiveTripNote = useCallback((note: string) => {
    setActiveTrip((prev) => (prev ? { ...prev, note } : null));
  }, []);

  const stopTrip = useCallback(async (): Promise<Trip | null> => {
    if (!activeTrip) return null;

    // Stop foreground watch
    if (watchRef.current !== null) {
      if (Platform.OS !== "web") {
        (watchRef.current as unknown as { remove: () => void })?.remove?.();
      } else {
        navigator.geolocation?.clearWatch(watchRef.current);
      }
      watchRef.current = null;
    }

    // Stop background location task and merge its positions
    let finalDistance = activeTrip.distance;
    if (Platform.OS !== "web") {
      try {
        const Location = await import("expo-location");
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch {
        // Non-fatal
      }

      // Read background positions and recalculate distance
      try {
        const bgRaw = await AsyncStorage.getItem(BG_POSITIONS_KEY);
        if (bgRaw) {
          const bgPositions = JSON.parse(bgRaw) as BgPosition[];
          if (bgPositions.length > 1) {
            let bgDist = 0;
            for (let i = 1; i < bgPositions.length; i++) {
              const d = haversine(
                bgPositions[i - 1].lat,
                bgPositions[i - 1].lon,
                bgPositions[i].lat,
                bgPositions[i].lon
              );
              if (d >= MIN_MOVE_KM) bgDist += d;
            }
            // Background track may be more complete (captures positions during backgrounding)
            finalDistance = Math.max(finalDistance, bgDist);
          }
        }
        await AsyncStorage.removeItem(BG_POSITIONS_KEY);
      } catch {
        // Non-fatal — use in-memory distance
      }
    }

    let pMs = totalPausedMs;
    if (paused && pauseStartedAt) pMs += Date.now() - pauseStartedAt;
    const durSec = Math.max(1, Math.floor((Date.now() - activeTrip.startTime - pMs) / 1000));
    const last = activeTrip.positions[activeTrip.positions.length - 1];

    // Capture positions for route calculation before clearing activeTrip
    const firstPos = activeTrip.positions.length > 0 ? activeTrip.positions[0] : null;
    setPendingTripCoords(firstPos && last ? {
      startLat: firstPos.lat,
      startLon: firstPos.lon,
      endLat: last.lat,
      endLon: last.lon,
    } : null);
    // Store the decimated breadcrumb trail so the map can render the actual driven path
    // without jank on long trips (capped at 200 points via Douglas-Peucker)
    setPendingTripPath(activeTrip.positions.length >= 2 ? decimatePath(activeTrip.positions) : null);

    const newTrip: Trip = {
      id: activeTrip.id,
      date: new Date(activeTrip.startTime).toISOString(),
      startAddr: activeTrip.startAddr || "Unbekannt",
      endAddr: last ? `${last.lat.toFixed(4)}°, ${last.lon.toFixed(4)}°` : "Unbekannt",
      km: Math.max(0.1, finalDistance),
      dur: durSec,
      type: activeTrip.type,
      waypoints: activeTrip.waypoints && activeTrip.waypoints.length > 0 ? activeTrip.waypoints : undefined,
      path: activeTrip.positions.length >= 2 ? decimatePath(activeTrip.positions) : undefined,
      ...(activeTrip.note?.trim() ? { note: activeTrip.note.trim() } : {}),
      ...(firstPos ? { startLat: firstPos.lat, startLon: firstPos.lon } : {}),
      ...(last ? { endLat: last.lat, endLon: last.lon } : {}),
    };

    // Async: geocode end address and update pending trip display
    if (last) {
      reverseGeocode(last.lat, last.lon).then((addr) => {
        setPendingTrip((prev) => (prev ? { ...prev, endAddr: addr } : null));
      });
    }

    // Async: calculate shortest road route via OSRM and store in trip
    if (firstPos && last) {
      fetchOsrmRoute(firstPos.lat, firstPos.lon, last.lat, last.lon).then((kmRoute) => {
        if (kmRoute !== null) {
          setPendingTrip((prev) => (prev ? { ...prev, kmRoute } : null));
        }
      });
    }

    setActiveTrip(null);
    AsyncStorage.setItem(DRIVE_TRIP_ACTIVE_KEY, "false").catch(() => {});
    if (Platform.OS !== "web") {
      cancelDriveWatchdog().catch(() => {});
    }
    setPaused(false);
    setPauseStartedAt(null);
    setTotalPausedMs(0);
    setGpsStatus("waiting");
    setPendingTrip(newTrip);
    return newTrip;
  }, [activeTrip, paused, pauseStartedAt, totalPausedMs]);

  const togglePause = useCallback((waypoint?: Waypoint) => {
    if (!paused) {
      // Guard: bail out if no active trip exists at execution time.
      // This prevents stale async geocoding callbacks from corrupting state
      // when the user stops the trip while geocoding is in flight.
      if (!activeTrip) return;
      if (waypoint) {
        setActiveTrip((prev) =>
          prev ? { ...prev, waypoints: [...(prev.waypoints ?? []), waypoint] } : prev
        );
      }
      setPaused(true);
      setPauseStartedAt(Date.now());
    } else {
      if (pauseStartedAt) {
        setTotalPausedMs((p) => p + Date.now() - pauseStartedAt);
      }
      setPaused(false);
      setPauseStartedAt(null);
    }
  }, [paused, pauseStartedAt, activeTrip]);

  // One-time background pass: geocode trips that have address text but no stored
  // coordinates. Runs at 1 req/s to stay within Nominatim's usage policy.
  const backfillMissingCoords = useCallback(async () => {
    const current = tripsRef.current;
    const needsBackfill = current.filter(
      (t) =>
        (t.startLat == null && !!t.startAddr) ||
        (t.endLat == null && !!t.endAddr)
    );
    if (needsBackfill.length === 0) return;

    for (const trip of needsBackfill) {
      const needsStart = trip.startLat == null && !!trip.startAddr;
      const needsEnd = trip.endLat == null && !!trip.endAddr;
      const changes: Partial<Trip> = {};

      if (needsStart) {
        const coord = await geocodeAddress(trip.startAddr);
        if (coord) {
          changes.startLat = coord.lat;
          changes.startLon = coord.lon;
        }
        // Rate-limit: 1 request per second
        await new Promise<void>((r) => setTimeout(r, 1100));
      }

      if (needsEnd) {
        const coord = await geocodeAddress(trip.endAddr);
        if (coord) {
          changes.endLat = coord.lat;
          changes.endLon = coord.lon;
        }
        await new Promise<void>((r) => setTimeout(r, 1100));
      }

      if (Object.keys(changes).length > 0) {
        editTrip(trip.id, changes);
      }
    }
  }, [editTrip]);

  // Schedule the coord backfill once, 5 s after the initial load completes,
  // so it never blocks the app startup or address-refresh pass.
  useEffect(() => {
    if (loading) return;
    if (autoBackfillDoneRef.current) return;
    if (!user) return;
    autoBackfillDoneRef.current = true;
    const tid = setTimeout(() => {
      backfillMissingCoords().catch(() => {});
    }, 5000);
    return () => clearTimeout(tid);
  }, [loading, user, backfillMissingCoords]);

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        syncStatus,
        isRefreshingAddresses,
        refreshAddresses,
        logout,
        deleteAccount,
        biometricLogin,
        login,
        register,
        updateProfile,
        updateCompanyInfo,
        updateVehicleData,
        updatePassword,
        requestPasswordChangeCode,
        confirmPasswordChange,
        requestEmailChangeCode,
        confirmEmailChange,
        trips,
        syncRetryingIds,
        addTrip,
        deleteTrip,
        editTrip,
        retryWaypointSync,
        activeTrip,
        paused,
        pauseStartedAt,
        totalPausedMs,
        gpsTracking: gpsTrackingPref,
        gpsStatus,
        livePos,
        startTrip,
        stopTrip,
        setActiveTripNote,
        togglePause,
        elapsed,
        pendingTrip,
        pendingTripCoords,
        pendingTripPath,
        finalizeTrip,
        discardPendingTrip,
        setTrackingPref,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
