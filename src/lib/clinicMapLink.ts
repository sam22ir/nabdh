type ClinicMapInput = {
  latitude?: number;
  longitude?: number;
  mapUrl?: string | null;
};

type ParsedClinicMap = {
  latitude?: number;
  longitude?: number;
  mapUrl: string;
};

const GOOGLE_MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query=';
const GOOGLE_MAPS_DIRECTIONS_BASE = 'https://www.google.com/maps/dir/?api=1&destination=';

function isValidCoordinatePair(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function toValidCoordinatePair(
  latitudeValue: string,
  longitudeValue: string,
): { latitude: number; longitude: number } | null {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!isValidCoordinatePair(latitude, longitude)) return null;
  return { latitude, longitude };
}

function parseRawCoordinatePair(value: string): { latitude: number; longitude: number } | null {
  const match = value.match(
    /^\s*([+-]?\d{1,3}(?:\.\d+)?)\s*(?:,|،|\s)\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/,
  );
  if (!match) return null;
  return toValidCoordinatePair(match[1], match[2]);
}

function parseCoordinatePair(value: string): { latitude: number; longitude: number } | null {
  const decoded = decodeURIComponent(value);
  const match = decoded.match(
    /(^|[^\d.-])([+-]?\d{1,3}(?:\.\d+)?)\s*(?:,|،|\s)\s*([+-]?\d{1,3}(?:\.\d+)?)(?=$|[^\d.])/,
  );
  if (!match) return null;
  return toValidCoordinatePair(match[2], match[3]);
}

function parseBangCoordinates(value: string): { latitude: number; longitude: number } | null {
  const decoded = decodeURIComponent(value);
  const match = decoded.match(/!3d([+-]?\d{1,3}(?:\.\d+)?)!4d([+-]?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;

  return toValidCoordinatePair(match[1], match[2]);
}

function isGoogleMapsUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl' && path.includes('/maps')) return true;
  if (host.startsWith('maps.google.')) return true;
  if (host === 'google.com' && path.includes('/maps')) return true;
  if (host.endsWith('.google.com') && path.includes('/maps')) return true;
  return /^www\.google\.[a-z.]+$/.test(host) && path.includes('/maps');
}

function coordinatesToSearchUrl(latitude: number, longitude: number): string {
  return `${GOOGLE_MAPS_SEARCH_BASE}${latitude},${longitude}`;
}

function coordinatesToDirectionsUrl(latitude: number, longitude: number): string {
  return `${GOOGLE_MAPS_DIRECTIONS_BASE}${latitude},${longitude}`;
}

export function parseClinicMapInput(input: string): ParsedClinicMap | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const rawCoordinates = parseRawCoordinatePair(trimmed);
  if (rawCoordinates) {
    return {
      ...rawCoordinates,
      mapUrl: coordinatesToSearchUrl(rawCoordinates.latitude, rawCoordinates.longitude),
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!isGoogleMapsUrl(url)) return null;

  const queryCoordinates =
    parseCoordinatePair(url.searchParams.get('query') ?? '') ||
    parseCoordinatePair(url.searchParams.get('q') ?? '') ||
    parseCoordinatePair(url.searchParams.get('ll') ?? '') ||
    parseCoordinatePair(url.toString()) ||
    parseBangCoordinates(url.toString());

  return {
    ...(queryCoordinates ?? {}),
    mapUrl: trimmed,
  };
}

export function formatClinicMapInput(clinic: ClinicMapInput): string {
  const mapUrl = clinic.mapUrl?.trim();
  if (mapUrl) return mapUrl;

  if (
    clinic.latitude !== undefined &&
    clinic.longitude !== undefined &&
    isValidCoordinatePair(clinic.latitude, clinic.longitude)
  ) {
    return `${clinic.latitude}, ${clinic.longitude}`;
  }

  return '';
}

export function getClinicMapUrl(clinic: ClinicMapInput): string | null {
  const mapUrl = clinic.mapUrl?.trim();
  if (mapUrl) return mapUrl;

  if (
    clinic.latitude !== undefined &&
    clinic.longitude !== undefined &&
    isValidCoordinatePair(clinic.latitude, clinic.longitude)
  ) {
    return coordinatesToDirectionsUrl(clinic.latitude, clinic.longitude);
  }

  return null;
}
