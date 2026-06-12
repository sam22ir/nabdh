import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("patient screens use backend data", () => {
  test("home does not fall back to mock doctors or appointments", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/index.tsx"),
      "utf8",
    );

    expect(source).toContain("api.bookings.getHomeData");
    expect(source).not.toContain("MOCK_UPCOMING_APPOINTMENT");
    expect(source).not.toContain("MOCK_DOCTORS_NEARBY");
    expect(source).not.toContain("fall back to mock");
  });

  test("profile uses Convex family profiles instead of fixture family members", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("api.patientProfiles.listMy");
    expect(source).not.toContain("MOCK_FAMILY_PROFILES");
    expect(source).not.toContain("useState<PatientProfile[]>");
  });

  test("profile action buttons are wired to working UI and backend actions", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("api.users.updateProfile");
    expect(source).toContain("api.users.completePatientProfile");
    expect(source).toContain("api.patientProfiles.create");
    expect(source).toContain("setEditModalVisible(true)");
    expect(source).toContain("setCompleteProfileModalVisible(true)");
    expect(source).toContain("setFamilyModalVisible(true)");
    expect(source).toContain("setPrivacyModalVisible(true)");
    expect(source).toContain("setLogoutModalVisible(true)");
    expect(source).toContain("api.locations.listCommunesByWilaya");
    expect(source).toContain("أكمل ملفك الطبي");
    expect(source).toContain("currentWilayaName");
    expect(source).not.toContain("value={user.wilayaId ?? '-'}");
    expect(source).not.toContain("تعديل الملف الشخصي قيد التطوير");
    expect(source).not.toContain("ملفات العائلة قيد التطوير");
    expect(source).not.toContain("سيتم فتح صفحة سياسة الخصوصية قريباً");
  });

  test("profile settings do not expose local-only language or theme toggles", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("settingsUnavailableBadge");
    expect(source).not.toContain("useLanguageStore");
    expect(source).not.toContain("setLanguage('ar')");
    expect(source).not.toContain("setLanguage('fr')");
    expect(source).not.toContain("<Switch");
    expect(source).not.toContain("setThemeEnabled");
  });

  test("search filter button opens filters instead of clearing them", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );

    expect(source).toContain("setFilterModalVisible(true)");
    expect(source).toContain("تصفية النتائج");
    expect(source).toContain("selectedSpecialty?.nameAr");
    expect(source).not.toContain("onFilterPress={handleClearFilters}");
  });

  test("search specialty filter uses real Convex specialty ids", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );

    expect(source).toContain("api.specialties.list");
    expect(source).toContain("useLocalSearchParams");
    expect(source).toContain("routeParamString(params.specialty)");
    expect(source).toContain("specialtyId: selectedSpecialtyId");
    expect(source).not.toContain("COMMON_SPECIALTIES");
  });

  test("search wilaya filter is visible and sent to Convex", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );

    expect(source).toContain("api.locations.listWilayas");
    expect(source).toContain("wilayaOptions");
    expect(source).toContain("wilayaId: selectedWilayaId ?? undefined");
    expect(source).toContain("setShowWilayaPicker(true)");
    expect(source).toContain('title="اختر الولاية"');
  });

  test("search available-today filter is sent to Convex and displayed on cards", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );

    expect(source).toContain("availableToday: availableTodayOnly || undefined");
    expect(source).toContain("isAvailableToday={item.isAvailableToday}");
    expect(source).not.toContain("isAvailableToday={false}");
  });

  test("doctor details can add or remove the doctor from favorites", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );

    expect(source).toContain("api.doctors.toggleFavorite");
    expect(source).toContain("api.doctors.isFavorite");
    expect(source).toContain("إضافة إلى المفضلة");
    expect(source).toContain("إزالة من المفضلة");
  });

  test("doctor details load schedules for all clinics", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );

    expect(source).toContain("api.schedules.getByDoctor");
    expect(source).not.toContain("primaryClinicId");
  });

  test("doctor detail main booking action starts at clinic selection", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );

    expect(source).toContain("pathname: '/(patient)/booking/clinic'");
    expect(source).not.toContain("pathname: '/(patient)/booking/datetime'");
  });

  test("doctor details block favorite toggles for incomplete patient profiles", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );

    expect(source).toContain("api.users.me");
    expect(source).toContain("!me?.profile");
    expect(source).toContain("أكمل ملفك الطبي");
    expect(source).toContain("getArabicErrorMessage");
    expect(source).not.toContain("Patient profile not found");
  });

  test("booking profile selection includes Convex family profiles", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/booking/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("api.patientProfiles.listMy");
    expect(source).toContain("familyProfiles.map");
  });

  test("booking datetime continues to profile selection before confirmation", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/booking/datetime.tsx"),
      "utf8",
    );

    expect(source).toContain("pathname: '/(patient)/booking/profile'");
    expect(source).not.toContain("pathname: '/(patient)/booking/confirm'");
  });

  test("booking flow blocks incomplete patient profiles before createBooking", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/booking/confirm.tsx"),
      "utf8",
    );

    expect(source).toContain("me.profile");
    expect(source).toContain("أكمل ملفك الطبي");
    expect(source).toContain("getArabicErrorMessage");
    expect(source).not.toContain("Patient profile not found");
  });

  test("patient-facing mutation errors use Arabic fallback messages", () => {
    const doctorSource = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );
    const confirmSource = readFileSync(
      join(process.cwd(), "app/(patient)/booking/confirm.tsx"),
      "utf8",
    );
    const appointmentsSource = readFileSync(
      join(process.cwd(), "app/(patient)/appointments.tsx"),
      "utf8",
    );
    const profileSource = readFileSync(
      join(process.cwd(), "app/(patient)/profile.tsx"),
      "utf8",
    );

    expect(doctorSource).not.toContain("? error.message");
    expect(confirmSource).not.toContain("? error.message");
    expect(appointmentsSource).not.toContain("? err.message");
    expect(profileSource).not.toContain("error?.message");
  });

  test("completed appointment review button opens a review action", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("api.reviews.create");
    expect(source).toContain("api.reviews.getMyPending");
    expect(source).toContain("reviewTarget");
    expect(source).toContain("handleReview");
    expect(source).toContain("onReview={() => handleReview(item)}");
    expect(source).toContain("onSubmit={handleSubmitReview}");
  });
});
