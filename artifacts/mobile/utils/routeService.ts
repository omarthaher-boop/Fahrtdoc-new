export interface RouteOption {
  id: string;
  label: string;
  km: number;
  durationMin: number;
  isShortest: boolean;
  isFastest: boolean;
}

const OSRM_BASE = "https://router.project-osrm.org";

export async function fetchRoutes(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<RouteOption[]> {
  const url =
    `${OSRM_BASE}/route/v1/driving/` +
    `${startLon},${startLat};${endLon},${endLat}` +
    `?alternatives=true&overview=false&steps=false`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`OSRM error ${res.status}`);

  const data = (await res.json()) as {
    code: string;
    routes?: Array<{ distance: number; duration: number }>;
  };

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("Keine Route gefunden");
  }

  const rawRoutes = data.routes;

  const shortestIdx = rawRoutes.reduce(
    (minI, r, i, arr) => (r.distance < arr[minI].distance ? i : minI),
    0
  );

  return rawRoutes.map((r, i) => {
    const isShortest = i === shortestIdx;
    const isFastest = i === 0;

    let label: string;
    if (isShortest && isFastest) label = "Kürzeste & schnellste Strecke";
    else if (isFastest) label = "Schnellste Strecke";
    else if (isShortest) label = "Kürzeste Strecke";
    else label = "Alternative Strecke";

    return {
      id: `route_${i}`,
      label,
      km: Math.round((r.distance / 1000) * 10) / 10,
      durationMin: Math.round(r.duration / 60),
      isShortest,
      isFastest,
    };
  });
}
