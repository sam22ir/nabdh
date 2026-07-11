export function stripArabicDoctorTitle(name: string) {
  return name.trim().replace(/^د\.\s*/u, "").replace(/^د\s+/u, "");
}
