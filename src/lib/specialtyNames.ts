export type SpecialtyNameSource = {
  name?: string;
  nameAr?: string;
  nameFr?: string;
};

export function specialtyDisplayName(specialty: SpecialtyNameSource) {
  return specialty.name ?? specialty.nameAr ?? specialty.nameFr ?? '';
}
