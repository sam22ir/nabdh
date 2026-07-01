export type DoctorVisibilityInput = {
  isProfileComplete?: boolean;
  orderRegistrationNumber?: string;
};

export function isPublicDoctorProfile(doctor: DoctorVisibilityInput): boolean {
  return Boolean(
    doctor.isProfileComplete ||
      (doctor.orderRegistrationNumber?.trim().length ?? 0) >= 3,
  );
}
