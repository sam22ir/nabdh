import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const appPath = (...parts: string[]) => join(process.cwd(), 'app', ...parts);

describe('clinic app route tree', () => {
  test('has clinic tab screens', () => {
    expect(existsSync(appPath('(clinic)', '_layout.tsx'))).toBe(true);
    expect(existsSync(appPath('(clinic)', 'dashboard.tsx'))).toBe(true);
    expect(existsSync(appPath('(clinic)', 'appointments.tsx'))).toBe(true);
    expect(existsSync(appPath('(clinic)', 'schedule.tsx'))).toBe(true);
    expect(existsSync(appPath('(clinic)', 'profile.tsx'))).toBe(true);
    expect(existsSync(appPath('(clinic)', 'settings.tsx'))).toBe(true);
    expect(existsSync(appPath('(clinic)', 'account-settings.tsx'))).toBe(true);
  });

  test('root layout mounts clinic route group', () => {
    const source = readFileSync(appPath('_layout.tsx'), 'utf8');
    expect(source).toContain('<Stack.Screen name="(clinic)" />');
  });

  test('clinic profile embeds doctor management without a separate doctors tab', () => {
    const layoutSource = readFileSync(appPath('(clinic)', '_layout.tsx'), 'utf8');
    const profileSource = readFileSync(appPath('(clinic)', 'profile.tsx'), 'utf8');
    const componentSource = readFileSync(
      join(process.cwd(), 'src', 'components', 'ClinicDoctorsManager.tsx'),
      'utf8',
    );

    expect(layoutSource).not.toContain('doctors:');
    expect(layoutSource).not.toContain("name=\"doctors\"");
    expect(profileSource).toContain('ClinicDoctorsManager');
    expect(profileSource).toContain('api.users.updateMyClinicProfile');
    expect(profileSource).toContain('api.locations.listWilayas');
    expect(profileSource).toContain('editModalVisible');
    expect(profileSource).toContain('Modal');
    expect(profileSource).toContain('حفظ التعديلات');
    expect(profileSource).toContain('الولاية');
    expect(componentSource).toContain('api.doctors.listPublic');
    expect(componentSource).toContain('const hasActiveSearch = searchText.trim().length > 0;');
    expect(componentSource).toContain('api.clinicMemberships.inviteDoctor');
    expect(componentSource).toContain('api.clinicMemberships.accept');
    expect(componentSource).toContain('api.clinicMemberships.reject');
    expect(componentSource).toContain('api.clinicMemberships.cancel');
    expect(componentSource).toContain('SearchBar');
    expect(componentSource).toContain('label="إرسال دعوة"');
    expect(componentSource).toContain('label="قبول"');
    expect(componentSource).toContain('label="رفض"');
    expect(componentSource).toContain('label="إلغاء الدعوة"');
  });

  test('clinic dashboard highlights doctors who are actually bookable today', () => {
    const source = readFileSync(appPath('(clinic)', 'dashboard.tsx'), 'utf8');

    expect(source).toContain('api.bookings.countMyClinicDoctorsAvailableToday');
    expect(source).toContain('api.bookings.countMyClinicBookedAppointments');
    expect(source).toContain('المختصون المتاحون للحجز اليوم');
    expect(source).toContain('إجمالي المواعيد المحجوزة');
    expect(source).not.toContain('طلبات معلقة');
    expect(source).not.toContain('api.clinicMemberships.listMyClinicDoctors');
    expect(source).not.toContain('api.users.me');
    expect(source).not.toContain('بيانات المركز');
    expect(source).not.toContain('DoctorSection');
  });

  test('clinic schedule screen manages doctor schedules from clinic schedule data', () => {
    const source = readFileSync(appPath('(clinic)', 'schedule.tsx'), 'utf8');

    expect(source).toContain('api.clinicMemberships.listMyClinicDoctors');
    expect(source).toContain('api.schedules.getByClinic');
    expect(source).toContain('api.schedules.getMyClinicExceptions');
    expect(source).toContain('api.schedules.upsertDay');
    expect(source).toContain('api.schedules.addClinicException');
    expect(source).toContain('api.schedules.removeException');
    expect(source).toContain('DoctorHeader');
    expect(source).toContain('DoctorSection');
    expect(source).toContain('اختر المختص');
    expect(source).toContain('الجدول الأسبوعي');
    expect(source).toContain('استثناءات المختص');
    expect(source).toContain('single_hour');
    expect(source).toContain('time_range');
    expect(source).toContain('multi_day');
    expect(source).toContain('doctorName');
    expect(source).toContain('selectedDoctorId');
  });

  test('clinic appointments screen loads real clinic bookings instead of placeholder copy', () => {
    const source = readFileSync(appPath('(clinic)', 'appointments.tsx'), 'utf8');

    expect(source).toContain('api.bookings.listMyClinicAppointments');
    expect(source).toContain('api.bookings.markPresent');
    expect(source).toContain('api.bookings.markCompleted');
    expect(source).toContain('api.bookings.syncMyClinicAppointmentStates');
    expect(source).toContain('DoctorHeader');
    expect(source).toContain('DoctorSection');
    expect(source).toContain('Modal');
    expect(source).toContain('selectedAppointment');
    expect(source).toContain('تفاصيل الموعد');
    expect(source).toContain('selectedDoctorId');
    expect(source).toContain('اختر المختص');
    expect(source).toContain('doctorChips');
    expect(source).toContain('doctorName');
    expect(source).toContain('patientName');
    expect(source).toContain('حاضر');
    expect(source).toContain('داخل عند المختص');
    expect(source).toContain('تم');
    expect(source).toContain('غائب');
    expect(source).not.toContain('تظهر هنا مواعيد المختصين المقبولين داخل المركز.');
  });

  test('clinic settings screen exposes automatic completion control', () => {
    const source = readFileSync(appPath('(clinic)', 'settings.tsx'), 'utf8');

    expect(source).toContain('api.clinicSettings.getMy');
    expect(source).toContain('api.clinicSettings.updateMy');
    expect(source).toContain('الإكمال التلقائي');
    expect(source).toContain('autoCompleteAppointments');
    expect(source).toContain('تنبيهات الحجوزات الجديدة');
    expect(source).toContain('تنبيهات الإلغاء');
    expect(source).toContain('الملخص اليومي');
  });

  test('clinic settings links to a hidden account settings screen with typed-confirmation deletion', () => {
    const layoutSource = readFileSync(appPath('(clinic)', '_layout.tsx'), 'utf8');
    const settingsSource = readFileSync(appPath('(clinic)', 'settings.tsx'), 'utf8');
    const accountSettingsSource = readFileSync(
      appPath('(clinic)', 'account-settings.tsx'),
      'utf8',
    );

    expect(layoutSource).toContain(
      '<Tabs.Screen name="account-settings" options={{ href: null }} />',
    );
    expect(settingsSource).toContain("router.push('/(clinic)/account-settings')");
    expect(settingsSource).toContain('إعدادات الحساب');
    expect(accountSettingsSource).toContain('api.users.deleteMyClinicAccount');
    expect(accountSettingsSource).toContain("router.push('/(clinic)/settings')");
  });
});
