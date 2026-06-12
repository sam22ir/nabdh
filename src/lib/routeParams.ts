type RouteParam = string | string[] | undefined;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function routeParamString(value: RouteParam): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isIsoDateParam(value: string | null): value is string {
  if (!value || !isoDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && value === date.toISOString().slice(0, 10);
}

export function isTimeParam(value: string | null): value is string {
  return value !== null && timePattern.test(value);
}
