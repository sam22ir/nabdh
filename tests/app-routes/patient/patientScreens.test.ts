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
    expect(source).toContain("api.patientProfiles.create");
    expect(source).toContain("setEditModalVisible(true)");
    expect(source).toContain("setFamilyModalVisible(true)");
    expect(source).toContain("setPrivacyModalVisible(true)");
    expect(source).toContain("setLogoutModalVisible(true)");
    expect(source).not.toContain("تعديل الملف الشخصي قيد التطوير");
    expect(source).not.toContain("ملفات العائلة قيد التطوير");
    expect(source).not.toContain("سيتم فتح صفحة سياسة الخصوصية قريباً");
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
    expect(source).toContain("specialtyId: selectedSpecialtyId");
    expect(source).not.toContain("COMMON_SPECIALTIES");
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

  test("doctor details block favorite toggles for incomplete patient profiles", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );

    expect(source).toContain("api.users.me");
    expect(source).toContain("!me?.profile");
    expect(source).toContain("أكمل ملفك الطبي");
    expect(source).toContain("Patient profile not found");
  });

  test("booking profile selection includes Convex family profiles", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/booking/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("api.patientProfiles.listMy");
    expect(source).toContain("familyProfiles.map");
  });

  test("booking flow blocks incomplete patient profiles before createBooking", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/booking/confirm.tsx"),
      "utf8",
    );

    expect(source).toContain("me.profile");
    expect(source).toContain("أكمل ملفك الطبي");
    expect(source).toContain("Patient profile not found");
  });
});
