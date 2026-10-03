export type SpecialtyNameSource = {
  name?: string;
  nameAr?: string;
  nameFr?: string;
};

// Specialty names are shown to users without clinical prefixes
// ("طب القلب" -> "القلب"), so they read as a service area, not a diagnosis.
export function neutralSpecialtyName(name: string) {
  const trimmed = name.trim();
  if (trimmed === 'طب عام' || trimmed === 'الطب العام') return 'استشارة عامة';
  return trimmed
    .replace(/^الطب\s+/u, '')
    .replace(/^طب\s+/u, '')
    .replace(/^الأمراض\s+/u, 'ال')
    .replace(/^أمراض\s+/u, '')
    .replace(/\s+الطبية$/u, '')
    .replace(/\s+الطبي$/u, '')
    .replace(/^علم\s+الأوبئة\s+و.*$/u, 'الوقاية')
    .replace(/^الإنعاش الطبي$/u, 'الإنعاش')
    .replace(/^التشريح المرضي$/u, 'التشريح')
    .replace(/^علاج الأورام بالإشعاع$/u, 'الأورام والإشعاع');
}

export function specialtyDisplayName(specialty: SpecialtyNameSource) {
  return neutralSpecialtyName(
    specialty.name ?? specialty.nameAr ?? specialty.nameFr ?? '',
  );
}
