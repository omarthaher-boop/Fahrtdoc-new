import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import * as ExpoCrypto from "expo-crypto";
import { secureGetItem, secureSetItem } from "@/utils/secureStorage";
import { LOCATION_TASK_NAME, BG_POSITIONS_KEY, BgPosition } from "@/utils/locationTask";

export interface Trip {
  id: string;
  date: string;
  startAddr: string;
  endAddr: string;
  km: number;
  dur: number;
  type: "business" | "private";
  edited?: boolean;
}

export interface ActiveTrip {
  id: string;
  startTime: number;
  type: "business" | "private";
  startAddr: string;
  distance: number;
  positions: { lat: number; lon: number }[];
}

export interface UserProfile {
  name: string;
  email: string;
  plate: string;
}

interface StoredAccount {
  name: string;
  plate: string;
  passwordHash: string;
}

interface SessionRecord {
  email: string;
  nonce: string;
  sessionToken: string;
}

interface AppContextType {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<"ok" | "not_found" | "wrong_password">;
  register: (name: string, email: string, plate: string, password: string) => Promise<"ok" | "exists">;
  updateProfile: (name: string, plate: string) => Promise<void>;
  updatePassword: (email: string, newPassword: string) => Promise<void>;
  trips: Trip[];
  addTrip: (t: Trip) => void;
  deleteTrip: (id: string) => void;
  editTrip: (id: string, changes: Partial<Trip>) => void;
  activeTrip: ActiveTrip | null;
  paused: boolean;
  pauseStartedAt: number | null;
  totalPausedMs: number;
  gpsStatus: "ok" | "denied" | "waiting";
  livePos: { lat: number; lon: number } | null;
  startTrip: (type: "business" | "private") => Promise<void>;
  stopTrip: () => Promise<Trip | null>;
  togglePause: () => void;
  elapsed: number;
}

const AppContext = createContext<AppContextType | null>(null);

function seedDate(offsetDays: number, hour = 12, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

const SEED_TRIPS: Trip[] = [
  { id: "a1", date: seedDate(0, 8, 14), startAddr: "Giessereistrasse 8, Arbon", endAddr: "Zielpunkt unbekannt", km: 0.0, dur: 66, type: "business", edited: true },
  { id: "a2", date: seedDate(1, 18, 12), startAddr: "Spitalstrasse, Herisau", endAddr: "Stickereistrasse, Arbon", km: 17.6, dur: 5160, type: "business", edited: true },
  { id: "a3", date: seedDate(1, 18, 11), startAddr: "Spitalstrasse 6, Herisau", endAddr: "Spitalstrasse 6, Herisau", km: 17.6, dur: 5100, type: "business", edited: true },
  { id: "a4", date: seedDate(3, 7, 55), startAddr: "Büro Mitte, Berlin", endAddr: "Musterstraße 12, Berlin", km: 11.2, dur: 1620, type: "business" },
  { id: "a5", date: seedDate(5, 14, 20), startAddr: "Musterstraße 12, Berlin", endAddr: "Klinikum Steglitz", km: 15.8, dur: 2280, type: "business" },
  { id: "a6", date: seedDate(10, 9, 0), startAddr: "Musterstraße 12, Berlin", endAddr: "Potsdam HBF", km: 31.4, dur: 2880, type: "private" },
  { id: "a7", date: seedDate(22, 16, 45), startAddr: "Ku'damm 100, Berlin", endAddr: "Tegel Gewerbepark", km: 19.3, dur: 2460, type: "business" },
  { id: "a8", date: seedDate(40, 8, 30), startAddr: "Musterstraße 12, Berlin", endAddr: "Cottbus HBF", km: 110.2, dur: 4920, type: "business" },
];

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

const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`,
      { signal: ctrl.signal }
    );
    clearTimeout(tid);
    const d = await r.json();
    const road = d.address?.road || "";
    const city =
      d.address?.city ||
      d.address?.town ||
      d.address?.village ||
      d.address?.suburb ||
      "";
    return [road, city].filter(Boolean).join(", ") || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  } catch {
    return `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
  }
};

async function sha256Hex(text: string): Promise<string> {
  return ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, text);
}

function tripsKey(email: string): string {
  return `trips_${email}`;
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
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const sessionToken = await makeSessionToken(passwordHash, nonce);
  const record: SessionRecord = { email, nonce, sessionToken };
  await AsyncStorage.setItem("session", JSON.stringify(record));
}

async function verifyAndRestoreSession(): Promise<{ profile: UserProfile; trips: Trip[] } | null> {
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
  const profile: UserProfile = { name: account.name, email: session.email, plate: account.plate };
  const raw2 = await secureGetItem(session.email, tripsKey(session.email));
  let trips: Trip[] = SEED_TRIPS;
  if (raw2) {
    try {
      const parsed: Trip[] = JSON.parse(raw2);
      if (parsed.length > 0) trips = parsed;
    } catch {
      // fall back to seed
    }
  }
  return { profile, trips };
}

// Maximum acceptable GPS accuracy (meters). Points less accurate than this are discarded.
const MAX_GPS_ACCURACY_M = 30;
// Minimum movement distance (km) to count — filters GPS jitter
const MIN_MOVE_KM = 0.005;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [paused, setPaused] = useState(false);
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [totalPausedMs, setTotalPausedMs] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<"ok" | "denied" | "waiting">("waiting");
  const [livePos, setLivePos] = useState<{ lat: number; lon: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const watchRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    verifyAndRestoreSession()
      .then((result) => {
        if (result) {
          setUserState(result.profile);
          setTrips(result.trips);
        }
      })
      .finally(() => setLoading(false));
  }, []);

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

  const logout = useCallback(async () => {
    setUserState(null);
    setTrips([]);
    await AsyncStorage.removeItem("session");
  }, []);

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<"ok" | "not_found" | "wrong_password"> => {
    const key = email.toLowerCase().trim();
    const accounts = await loadAccounts();
    let account = accounts[key];

    if (!account) {
      const migrated = await migrateOldCredentials(key, password);
      if (migrated === "wrong_password") return "wrong_password";
      if (migrated === "not_found") return "not_found";
      account = migrated;
    }

    const hash = await sha256Hex(password);
    if (hash !== account.passwordHash) return "wrong_password";
    await storeSession(key, account.passwordHash);
    const profile: UserProfile = { name: account.name, email: key, plate: account.plate };
    setUserState(profile);
    const raw = await secureGetItem(key, tripsKey(key));
    let loaded: Trip[] = SEED_TRIPS;
    if (raw) {
      try {
        const parsed: Trip[] = JSON.parse(raw);
        if (parsed.length > 0) loaded = parsed;
      } catch {
        // keep seed
      }
    } else {
      const oldTrips = await AsyncStorage.getItem("trips");
      if (oldTrips) {
        try {
          const parsed: Trip[] = JSON.parse(oldTrips);
          if (parsed.length > 0) {
            loaded = parsed;
            await secureSetItem(key, tripsKey(key), JSON.stringify(parsed));
          }
        } catch {
          // keep seed
        }
      }
    }
    setTrips(loaded);
    return "ok";
  }, []);

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
    await secureSetItem(key, tripsKey(key), JSON.stringify(SEED_TRIPS));
    setTrips(SEED_TRIPS);
    return "ok";
  }, []);

  const updateProfile = useCallback(async (name: string, plate: string) => {
    if (!user) return;
    const accounts = await loadAccounts();
    if (!accounts[user.email]) return;
    accounts[user.email].name = name;
    accounts[user.email].plate = plate;
    await saveAccounts(accounts);
    setUserState((u) => u ? { ...u, name, plate } : u);
  }, [user]);

  const updatePassword = useCallback(async (email: string, newPassword: string) => {
    const key = email.toLowerCase().trim();
    const accounts = await loadAccounts();
    if (!accounts[key]) return;
    const passwordHash = await sha256Hex(newPassword);
    accounts[key].passwordHash = passwordHash;
    await saveAccounts(accounts);
    await storeSession(key, passwordHash);
  }, []);

  const persistTrips = useCallback((next: Trip[], email: string) => {
    secureSetItem(email, tripsKey(email), JSON.stringify(next));
  }, []);

  const addTrip = useCallback(async (t: Trip) => {
    setTrips((prev) => {
      const next = [t, ...prev];
      setUserState((u) => {
        if (u) persistTrips(next, u.email);
        return u;
      });
      return next;
    });
  }, [persistTrips]);

  const deleteTrip = useCallback(async (id: string) => {
    setTrips((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setUserState((u) => {
        if (u) persistTrips(next, u.email);
        return u;
      });
      return next;
    });
  }, [persistTrips]);

  const editTrip = useCallback((id: string, changes: Partial<Trip>) => {
    setTrips((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...changes } : t));
      setUserState((u) => {
        if (u) persistTrips(next, u.email);
        return u;
      });
      return next;
    });
  }, [persistTrips]);

  const startTrip = useCallback(
    async (type: "business" | "private") => {
      setGpsStatus("waiting");
      const tripId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      const beginTracking = (lat: number, lon: number) => {
        setLivePos({ lat, lon });
        setGpsStatus("ok");
        setActiveTrip({
          id: tripId,
          startTime: Date.now(),
          type,
          startAddr: "",
          distance: 0,
          positions: [{ lat, lon }],
        });
        reverseGeocode(lat, lon).then((addr) => {
          setActiveTrip((prev) =>
            prev ? { ...prev, startAddr: addr } : prev
          );
        });
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
        const Location = await import("expo-location");

        // 1. Foreground permission
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== "granted") {
          setGpsStatus("denied");
          beginTracking(52.52, 13.405);
          return;
        }

        // 2. Background permission (best-effort — required for background tracking)
        try {
          await Location.requestBackgroundPermissionsAsync();
        } catch {
          // Permission may not be available in Expo Go — continue with foreground only
        }

        // 3. High-accuracy initial fix
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        beginTracking(initial.coords.latitude, initial.coords.longitude);

        // 4. Clear background position store for this new trip
        await AsyncStorage.removeItem(BG_POSITIONS_KEY);

        // 5. Start background location task (persists positions even when app is backgrounded)
        try {
          const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
          if (!alreadyRunning) {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 2000,
              distanceInterval: 5,
              foregroundService: {
                notificationTitle: "DriveLog",
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

        // 6. Foreground watch — keeps React state & live banner updated
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
      }
    },
    []
  );

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

    const newTrip: Trip = {
      id: activeTrip.id,
      date: new Date(activeTrip.startTime).toISOString(),
      startAddr: activeTrip.startAddr || "Unbekannt",
      endAddr: last ? `${last.lat.toFixed(4)}°, ${last.lon.toFixed(4)}°` : "Unbekannt",
      km: Math.max(0.1, finalDistance),
      dur: durSec,
      type: activeTrip.type,
    };

    if (last) {
      reverseGeocode(last.lat, last.lon).then((addr) => {
        setTrips((prev) => {
          const next = prev.map((t) => (t.id === newTrip.id ? { ...t, endAddr: addr } : t));
          setUserState((u) => {
            if (u) persistTrips(next, u.email);
            return u;
          });
          return next;
        });
      });
    }

    setActiveTrip(null);
    setPaused(false);
    setPauseStartedAt(null);
    setTotalPausedMs(0);
    setGpsStatus("waiting");
    addTrip(newTrip);
    return newTrip;
  }, [activeTrip, paused, pauseStartedAt, totalPausedMs, addTrip, persistTrips]);

  const togglePause = useCallback(() => {
    if (!paused) {
      setPaused(true);
      setPauseStartedAt(Date.now());
    } else {
      if (pauseStartedAt) {
        setTotalPausedMs((p) => p + Date.now() - pauseStartedAt);
      }
      setPaused(false);
      setPauseStartedAt(null);
    }
  }, [paused, pauseStartedAt]);

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        logout,
        login,
        register,
        updateProfile,
        updatePassword,
        trips,
        addTrip,
        deleteTrip,
        editTrip,
        activeTrip,
        paused,
        pauseStartedAt,
        totalPausedMs,
        gpsStatus,
        livePos,
        startTrip,
        stopTrip,
        togglePause,
        elapsed,
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
