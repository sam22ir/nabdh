import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("doctor screens use backend data", () => {
  test("dashboard is backed by Convex bookings instead of mock appointments", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );

    expect(source).toContain("api.bookings.getHomeDataDoctor");
    expect(source).toContain("api.bookings.markCompleted");
    expect(source).toContain("api.bookings.markNoShow");
    expect(source).not.toContain("MOCK_APPOINTMENTS");
    expect(source).not.toContain("MOCK_TODAY");
  });

  test("profile saves through Convex instead of logging fake saves", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("api.doctors.getMyProfile");
    expect(source).toContain("api.doctors.updateProfile");
    expect(source).not.toContain("MOCK_INITIAL_DATA");
    expect(source).not.toContain("SPECIALTIES_MOCK");
    expect(source).not.toContain("console.log('Saving profile data");
    expect(source).not.toContain("Simulate network latency");
  });

  test("profile clinic management uses Convex mutations instead of a placeholder", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("api.clinics.create");
    expect(source).toContain("api.clinics.update");
    expect(source).toContain("api.clinics.delete_");
    expect(source).toContain("api.locations.listWilayas");
    expect(source).toContain("handleSaveClinic");
    expect(source).toContain("handleEditClinic");
    expect(source).not.toContain("ClinicsPlaceholder");
    expect(source).not.toContain("قريباً");
  });

  test("appointments screen is backed by Convex bookings instead of mock appointments", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("api.bookings.listDoctorToday");
    expect(source).toContain("api.bookings.listDoctorWeek");
    expect(source).toContain("api.bookings.listDoctorMonth");
    expect(source).toContain("api.bookings.cancel");
    expect(source).toContain("api.bookings.updateDoctorNote");
    expect(source).not.toContain("MOCK_APPOINTMENTS");
    expect(source).not.toContain("MOCK_TODAY");
    expect(source).not.toContain("setTimeout");
  });

  test("schedule screen is backed by Convex schedules instead of local fixtures", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/schedule.tsx"),
      "utf8",
    );

    expect(source).toContain("api.clinics.getMyClinics");
    expect(source).toContain("api.schedules.getMySchedules");
    expect(source).toContain("api.schedules.getMyExceptions");
    expect(source).toContain("api.schedules.upsertDay");
    expect(source).toContain("api.schedules.addException");
    expect(source).toContain("api.schedules.removeException");
    expect(source).not.toContain("MOCK_CLINICS");
    expect(source).not.toContain("MOCK_EXCEPTIONS");
    expect(source).not.toContain("buildMockScheduleMap");
    expect(source).not.toContain("console.log('Saving schedule");
  });

  test("schedule route is registered in the doctor tab bar", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/_layout.tsx"),
      "utf8",
    );

    expect(source).toContain('<Tabs.Screen name="schedule" />');
    expect(source).toContain('schedule: "calendar"');
    expect(source).toContain('schedule: "الجدول"');
  });

  test("settings privacy and logout rows open working modals", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );

    expect(source).toContain("setPrivacyModalVisible(true)");
    expect(source).toContain("setLogoutModalVisible(true)");
    expect(source).toContain("privacyModalVisible");
    expect(source).toContain("logoutModalVisible");
    expect(source).not.toContain("سياسة الخصوصية قيد التطوير");
  });

  test("settings controls are persisted instead of local-only state", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );

    expect(source).toContain("useDoctorSettingsStore");
    expect(source).toContain("setNewBookingAlerts");
    expect(source).toContain("setCancellationAlerts");
    expect(source).toContain("setDailySummary");
    expect(source).toContain("setMinCancelHours");
    expect(source).not.toContain("const [newBookingAlerts");
    expect(source).not.toContain("const [cancellationAlerts");
    expect(source).not.toContain("const [dailySummary");
    expect(source).not.toContain("const [minCancelHours");
  });
});
