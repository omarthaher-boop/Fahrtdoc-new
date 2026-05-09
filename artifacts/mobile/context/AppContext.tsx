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

export interface Trip {
  id: string;
  date: string;
  startAddr: string;
  endAddr: string;
  km: number;
  dur: number;
  type: "business" | "private";
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

interface AppContextType {
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  register: (profile: UserProfile, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  updatePassword: (email: string, newPassword: string) => Promise<void>;
  trips: Trip[];
  addTrip: (t: Trip) => void;
  deleteTrip: (id: string) => void;
  activeTrip: ActiveTrip | null;
  paused: boolean;
  pauseStartedAt: number | null;
  totalPausedMs: number;
  gpsStatus: "ok" | "denied" | "waiting";
  livePos: { lat: number; lon: number } | null;
  startTrip: (type: "business" | "private") => Promise<void>;
  stopTrip: () => Trip | null;
  togglePause: () => void;
  elapsed: number;
}

const AppContext = createContext<AppContextType | null>(null);

const SEED_TRIPS: Trip[] = [
  { id: "a1", date: "2026-04-28T08:14:00", startAddr: "Musterstraße 12, Berlin", endAddr: "Alexanderplatz 1, Berlin", km: 8.4, dur: 1080, type: "private" },
  { id: "a2", date: "2026-04-27T17:30:00", startAddr: "Potsdamer Platz, Berlin", endAddr: "Flughafen BER", km: 22.1, dur: 2040, type: "business" },
  { id: "a3", date: "2026-04-25T12:10:00", startAddr: "Musterstraße 12, Berlin", endAddr: "REWE Schöneberg", km: 3.7, dur: 540, type: "private" },
  { id: "a4", date: "2026-04-22T07:55:00", startAddr: "Büro Mitte, Berlin", endAddr: "Musterstraße 12, Berlin", km: 11.2, dur: 1620, type: "business" },
  { id: "a5", date: "2026-04-20T14:20:00", startAddr: "Musterstraße 12, Berlin", endAddr: "Klinikum Steglitz", km: 15.8, dur: 2280, type: "business" },
  { id: "a6", date: "2026-03-30T09:00:00", startAddr: "Musterstraße 12, Berlin", endAddr: "Potsdam HBF", km: 31.4, dur: 2880, type: "private" },
  { id: "a7", date: "2026-03-18T16:45:00", startAddr: "Ku'damm 100, Berlin", endAddr: "Tegel Gewerbepark", km: 19.3, dur: 2460, type: "business" },
  { id: "a8", date: "2026-02-14T08:30:00", startAddr: "Musterstraße 12, Berlin", endAddr: "Cottbus HBF", km: 110.2, dur: 4920, type: "business" },
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
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
    (async () => {
      const u = await AsyncStorage.getItem("user");
      if (u) setUserState(JSON.parse(u));
      const t = await AsyncStorage.getItem("trips");
      if (t) {
        const stored: Trip[] = JSON.parse(t);
        setTrips(stored.length > 0 ? stored : SEED_TRIPS);
      } else {
        setTrips(SEED_TRIPS);
      }
    })();
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

  const setUser = useCallback(async (u: UserProfile | null) => {
    setUserState(u);
    if (u) await AsyncStorage.setItem("user", JSON.stringify(u));
    else await AsyncStorage.removeItem("user");
  }, []);

  const register = useCallback(async (profile: UserProfile, password: string) => {
    const creds = await AsyncStorage.getItem("credentials");
    const credsMap: Record<string, string> = creds ? JSON.parse(creds) : {};
    credsMap[profile.email.trim().toLowerCase()] = password;
    await AsyncStorage.setItem("credentials", JSON.stringify(credsMap));
    setUserState(profile);
    await AsyncStorage.setItem("user", JSON.stringify(profile));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const creds = await AsyncStorage.getItem("credentials");
    const credsMap: Record<string, string> = creds ? JSON.parse(creds) : {};
    const key = email.trim().toLowerCase();
    if (credsMap[key] !== undefined && credsMap[key] !== password) {
      return false;
    }
    const u = await AsyncStorage.getItem("user");
    if (u) {
      const parsed: UserProfile = JSON.parse(u);
      if (parsed.email.trim().toLowerCase() === key) {
        setUserState(parsed);
        return true;
      }
    }
    const fallbackProfile: UserProfile = {
      name: email.split("@")[0] || "Fahrer",
      email,
      plate: "B-DL-123",
    };
    setUserState(fallbackProfile);
    await AsyncStorage.setItem("user", JSON.stringify(fallbackProfile));
    return true;
  }, []);

  const updatePassword = useCallback(async (email: string, newPassword: string) => {
    const creds = await AsyncStorage.getItem("credentials");
    const credsMap: Record<string, string> = creds ? JSON.parse(creds) : {};
    credsMap[email.trim().toLowerCase()] = newPassword;
    await AsyncStorage.setItem("credentials", JSON.stringify(credsMap));
  }, []);

  const addTrip = useCallback(async (t: Trip) => {
    setTrips((prev) => {
      const next = [t, ...prev];
      AsyncStorage.setItem("trips", JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteTrip = useCallback(async (id: string) => {
    setTrips((prev) => {
      const next = prev.filter((t) => t.id !== id);
      AsyncStorage.setItem("trips", JSON.stringify(next));
      return next;
    });
  }, []);

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
          { timeout: 5000 }
        );
        navigator.geolocation?.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            setLivePos({ lat, lon });
            setActiveTrip((prev) => {
              if (!prev) return prev;
              const last = prev.positions[prev.positions.length - 1];
              const d = haversine(last.lat, last.lon, lat, lon);
              return {
                ...prev,
                distance: prev.distance + d,
                positions: [...prev.positions, { lat, lon }],
              };
            });
          },
          undefined,
          { enableHighAccuracy: true }
        );
      } else {
        const Location = await import("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setGpsStatus("denied");
          beginTracking(52.52, 13.405);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        beginTracking(loc.coords.latitude, loc.coords.longitude);
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          (loc2) => {
            const lat = loc2.coords.latitude;
            const lon = loc2.coords.longitude;
            setLivePos({ lat, lon });
            setActiveTrip((prev) => {
              if (!prev) return prev;
              const last = prev.positions[prev.positions.length - 1];
              const d = haversine(last.lat, last.lon, lat, lon);
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

  const stopTrip = useCallback((): Trip | null => {
    if (!activeTrip) return null;
    if (watchRef.current !== null) {
      if (Platform.OS !== "web") {
        (watchRef.current as unknown as { remove: () => void })?.remove?.();
      } else {
        navigator.geolocation?.clearWatch(watchRef.current);
      }
      watchRef.current = null;
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
      km: Math.max(0.1, activeTrip.distance),
      dur: durSec,
      type: activeTrip.type,
    };
    if (last) {
      reverseGeocode(last.lat, last.lon).then((addr) => {
        setTrips((prev) => {
          const next = prev.map((t) => (t.id === newTrip.id ? { ...t, endAddr: addr } : t));
          AsyncStorage.setItem("trips", JSON.stringify(next));
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
  }, [activeTrip, paused, pauseStartedAt, totalPausedMs, addTrip]);

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
        setUser,
        register,
        login,
        updatePassword,
        trips,
        addTrip,
        deleteTrip,
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
