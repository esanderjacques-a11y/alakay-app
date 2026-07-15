export type GeoLocationResult = {
  latitude: number;
  longitude: number;
  country: string | null;
  province: string | null;
  displayName: string | null;
  source: "gps";
};

export type GeoLocationErrorCode =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout"
  | "reverse_failed"
  | "unknown";

function mapGeoError(error: GeolocationPositionError): GeoLocationErrorCode {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.POSITION_UNAVAILABLE) return "unavailable";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unknown";
}

export async function detectLocation(): Promise<GeoLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw Object.assign(new Error("Geolocation unsupported"), {
      code: "unsupported" as GeoLocationErrorCode,
    });
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60_000,
    });
  }).catch((error: GeolocationPositionError) => {
    throw Object.assign(new Error(error.message || "Geolocation failed"), {
      code: mapGeoError(error),
    });
  });

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "8");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error("Reverse geocode failed");
    }
    const data = (await response.json()) as {
      display_name?: string;
      address?: {
        country?: string;
        state?: string;
        region?: string;
        province?: string;
        county?: string;
      };
    };
    const address = data.address || {};
    return {
      latitude,
      longitude,
      country: address.country || null,
      province:
        address.state || address.region || address.province || address.county || null,
      displayName: data.display_name || null,
      source: "gps",
    };
  } catch {
    return {
      latitude,
      longitude,
      country: null,
      province: null,
      displayName: null,
      source: "gps",
    };
  }
}
