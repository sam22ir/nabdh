// Converts Supabase rows (snake_case, uuid `id`) into the document shape the
// screens were written against (camelCase, `_id`, `_creationTime`, ms
// timestamps, "HH:MM" times).

const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function convertKeyValue(key: string, value: unknown): [string, unknown] {
  if (key === 'id') return ['_id', value];
  if (key === 'created_at') {
    return ['_creationTime', typeof value === 'string' ? Date.parse(value) : value];
  }
  if (key.endsWith('_at') && typeof value === 'string') {
    return [camel(key), Date.parse(value)];
  }
  if (key.endsWith('_time') && typeof value === 'string' && /^\d{2}:\d{2}:\d{2}/.test(value)) {
    return [camel(key), value.slice(0, 5)];
  }
  // Wilayas used to be document ids (strings); keep them as strings.
  if (key === 'wilaya_id' && typeof value === 'number') {
    return [camel(key), String(value)];
  }
  return [camel(key), value];
}

export function toDoc<T = any>(row: unknown): T {
  if (Array.isArray(row)) return row.map((item) => toDoc(item)) as T;
  if (row === null || typeof row !== 'object') return row as T;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    const [newKey, newValue] = convertKeyValue(key, value);
    out[newKey] = newValue !== null && typeof newValue === 'object' ? toDoc(newValue) : newValue;
  }
  return out as T;
}

export function toDocs<T = any>(rows: unknown[] | null | undefined): T[] {
  return (rows ?? []).map((row) => toDoc<T>(row));
}

/** Inverse for ids that screens pass back (wilaya ids are numbers in SQL). */
export function wilayaIdToSql(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
