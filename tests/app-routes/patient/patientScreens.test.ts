import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("patient screens use backend data", () => {
  test("patient search supports doctor and clinic discovery modes", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );

    expect(source).toContain("searchMode");
    expect(source).toContain("api.doctors.listPublic");
    expect(source).toContain("api.clinics.listPublic");
    expect(source).toContain("المختصين");
    expect(source).toContain("المراكز");
    expect(source).toContain("acceptedClinicId");
    expect(source).toContain("isBookable");
  });

  test("booking starts from clinic and then selects a doctor", () => {
    const clinicSource = readFileSync(
      join(process.cwd(), "app/(patient)/booking/clinic.tsx"),
      "utf8",
    );
    const dateTimeSource = readFileSync(
      join(process.cwd(), "app/(patient)/booking/datetime.tsx"),
      "utf8",
    );
    const doctorProfileSource = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );

    expect(clinicSource).toContain("api.clinics.getBookingContext");
    expect(clinicSource).toContain("clinicId");
    expect(clinicSource).toContain("doctorId");
    expect(clinicSource).toContain("اختيار المختص");
    expect(dateTimeSource).toContain("doctorId: doctorId as Id<'doctors'>");
    expect(dateTimeSource).toContain("api.bookings.getAvailableSlots");
    expect(doctorProfileSource).toContain("acceptedClinicId");
    expect(doctorProfileSource).toContain("isBookable");
  });

  test("patient tab shell uses the official restrained product theme", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/_layout.tsx"),
      "utf8",
    );

    expect(source).toContain("import { theme }");
    expect(source).toContain("tabBarActiveTintColor: theme.colors.official");
    expect(source).toContain("tabBarInactiveTintColor: theme.colors.textMuted");
    expect(source).toContain("tabBarLabelStyle: styles.tabBarLabel");
    expect(source).toContain("tabBarStyle: styles.tabBar");
    expect(source).toContain("tabBarItemStyle: styles.tabBarItem");
    expect(source).toContain("height: 76");
    expect(source).toContain("lineHeight: 14");
    expect(source).toContain(
      '<Tabs.Screen name="account-settings" options={{ href: null }} />',
    );
    expect(source).not.toContain("direction:");
    expect(source).not.toContain("writingDirection:");
    expect(source).not.toContain('color="#1A7BC4"');
  });

  test("patient discovery components avoid emoji-led healthcare shortcuts", () => {
    const homeSource = readFileSync(
      join(process.cwd(), "app/(patient)/index.tsx"),
      "utf8",
    );
    const specialtyGridSource = readFileSync(
      join(process.cwd(), "src/components/SpecialtyGrid.tsx"),
      "utf8",
    );

    expect(homeSource).toContain("icon: 'medical-outline'");
    expect(homeSource).toContain("icon: 'fitness-outline'");
    expect(homeSource).toContain("icon: 'eye-outline'");
    expect(homeSource).toContain("getSpecialtyIcon");
    expect(homeSource).toContain("specialty.name");
    expect(homeSource).toContain("api.doctors.listPublic");
    expect(homeSource).toContain("filteredDoctorsNearby");
    expect(homeSource).toContain("search?specialty=");
    expect(homeSource).not.toContain("🩺");
    expect(homeSource).not.toContain("🦷");
    expect(homeSource).not.toContain("❤️");
    expect(homeSource).not.toContain("👁️");
    expect(homeSource).not.toContain("👶");
    expect(specialtyGridSource).toContain("Ionicons");
    expect(specialtyGridSource).toContain("glyphMap");
    expect(specialtyGridSource).not.toContain("iconEmoji");
    expect(specialtyGridSource).not.toContain("iconFallback");
  });

  test("popular specialties row supports horizontal nested scrolling", () => {
    const homeSource = readFileSync(
      join(process.cwd(), "app/(patient)/index.tsx"),
      "utf8",
    );
    const specialtyGridSource = readFileSync(
      join(process.cwd(), "src/components/SpecialtyGrid.tsx"),
      "utf8",
    );

    expect(homeSource).toContain("nestedScrollEnabled");
    expect(homeSource).toContain("directionalLockEnabled");
    expect(specialtyGridSource).toContain("style={styles.list}");
    expect(specialtyGridSource).toContain("nestedScrollEnabled");
    expect(specialtyGridSource).toContain("directionalLockEnabled");
    expect(specialtyGridSource).toContain("scrollEnabled={specialties.length > 1}");
    expect(specialtyGridSource).toContain("list: {");
    expect(specialtyGridSource).toContain("flexGrow: 0");
  });

  test("patient appointment and favorite empty states use official icon names", () => {
    const appointmentsSource = readFileSync(
      join(process.cwd(), "app/(patient)/appointments.tsx"),
      "utf8",
    );
    const favoritesSource = readFileSync(
      join(process.cwd(), "app/(patient)/favorites.tsx"),
      "utf8",
    );

    expect(appointmentsSource).toContain("icon: 'calendar-outline'");
    expect(appointmentsSource).toContain("icon: 'document-text-outline'");
    expect(appointmentsSource).toContain("icon: 'close-circle-outline'");
    expect(appointmentsSource).not.toContain("📅");
    expect(appointmentsSource).not.toContain("📋");
    expect(appointmentsSource).not.toContain("🚫");
    expect(favoritesSource).toContain('icon="heart-outline"');
    expect(favoritesSource).not.toContain("💔");
  });

  test("patient appointment and profile tabs use shared product primitives", () => {
    const appointmentsSource = readFileSync(
      join(process.cwd(), "app/(patient)/appointments.tsx"),
      "utf8",
    );
    const profileSource = readFileSync(
      join(process.cwd(), "app/(patient)/profile.tsx"),
      "utf8",
    );
    const appointmentCardSource = readFileSync(
      join(process.cwd(), "src/components/AppointmentCard.tsx"),
      "utf8",
    );

    expect(appointmentsSource).toContain("AppHeader");
    expect(appointmentsSource).toContain("Badge");
    expect(appointmentsSource).toContain("LoadingState");
    expect(appointmentsSource).toContain("styles.segmentedTabs");
    expect(profileSource).toContain("AppHeader");
    expect(profileSource).toContain("Panel");
    expect(profileSource).toContain("Badge");
    expect(profileSource).toContain("LoadingState");
    expect(appointmentCardSource).toContain("Panel");
    expect(appointmentCardSource).toContain("Badge");
    expect(appointmentCardSource).toContain("TrustRow");
    expect(appointmentCardSource).not.toContain("...theme.shadows.md");
  });

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

  test("patient confirmed bookings are labeled as upcoming instead of confirmed", () => {
    const homeSource = readFileSync(
      join(process.cwd(), "app/(patient)/index.tsx"),
      "utf8",
    );
    const appointmentCardSource = readFileSync(
      join(process.cwd(), "src/components/AppointmentCard.tsx"),
      "utf8",
    );

    expect(homeSource).toContain('title="موعدك القادم"');
    expect(homeSource).not.toContain('Badge label="قادم"');
    expect(appointmentCardSource).toContain("label: 'قادم'");
    expect(homeSource).not.toContain('Badge label="مؤكد"');
    expect(appointmentCardSource).not.toContain("label: 'مؤكد'");
  });

  test("patient home opens a ticket-style appointment modal from the upcoming card", () => {
    const homeSource = readFileSync(
      join(process.cwd(), "app/(patient)/index.tsx"),
      "utf8",
    );

    expect(homeSource).toContain("UpcomingAppointmentModal");
    expect(homeSource).toContain("const [isUpcomingModalVisible, setIsUpcomingModalVisible] = useState(false)");
    expect(homeSource).toContain("setIsUpcomingModalVisible(true)");
    expect(homeSource).toContain("مكان رمز QR");
    expect(homeSource).toContain("يرجى الحضور قبل 15 دقيقة من الموعد");
    expect(homeSource).not.toContain("Medical Appointment");
    expect(homeSource).not.toContain("رقم الموعد");
  });

  test("patient appointments show doctor notes saved from the doctor dashboard", () => {
    const appointmentsSource = readFileSync(
      join(process.cwd(), "app/(patient)/appointments.tsx"),
      "utf8",
    );
    const appointmentCardSource = readFileSync(
      join(process.cwd(), "src/components/AppointmentCard.tsx"),
      "utf8",
    );
    const typesSource = readFileSync(
      join(process.cwd(), "src/lib/types.ts"),
      "utf8",
    );

    expect(typesSource).toContain("doctorNote: string | null");
    expect(appointmentsSource).toContain("doctorNote: item.doctorNote ?? null");
    expect(appointmentsSource).toContain("doctorNote: item.doctorNote");
    expect(appointmentCardSource).toContain('label="ملاحظة المختص"');
    expect(appointmentCardSource).toContain("value={appointment.doctorNote}");
  });

  test("patient cancelled appointment cards show the cancellation reason", () => {
    const appointmentsSource = readFileSync(
      join(process.cwd(), "app/(patient)/appointments.tsx"),
      "utf8",
    );
    const appointmentCardSource = readFileSync(
      join(process.cwd(), "src/components/AppointmentCard.tsx"),
      "utf8",
    );
    const typesSource = readFileSync(
      join(process.cwd(), "src/lib/types.ts"),
      "utf8",
    );

    expect(typesSource).toContain("cancellationReason: string | null");
    expect(appointmentsSource).toContain("cancellationReason: item.cancellationReason ?? null");
    expect(appointmentsSource).toContain("cancellationReason: item.cancellationReason");
    expect(appointmentCardSource).toContain("isCancelled");
    expect(appointmentCardSource).toContain("appointment.cancellationReason");
    expect(appointmentCardSource).toContain('label="سبب الإلغاء"');
    expect(appointmentCardSource).toContain("value={appointment.cancellationReason}");
  });

  test("patient cancelled appointment tap alert shows cancellation reason without undefined", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("item.status === 'cancelled'");
    expect(source).toContain("const cancellationReason =");
    expect(source).toContain("item.cancellationReason?.trim()");
    expect(source).toContain("لم يتم تسجيل سبب الإلغاء");
    expect(source).toContain("سبب الإلغاء: ${cancellationReason}");
    expect(source).toContain("item.clinicName ?? item.clinic?.name ?? 'المركز غير محدد'");
    expect(source).not.toContain("item.cancelReason");
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

  test("patient profile links to a hidden account settings screen with typed-confirmation deletion", () => {
    const profileSource = readFileSync(
      join(process.cwd(), "app/(patient)/profile.tsx"),
      "utf8",
    );
    const accountSettingsSource = readFileSync(
      join(process.cwd(), "app/(patient)/account-settings.tsx"),
      "utf8",
    );

    expect(profileSource).toContain("label=\"إعدادات الحساب\"");
    expect(profileSource).toContain("router.push('/(patient)/account-settings')");
    expect(accountSettingsSource).toContain("api.users.deleteMyPatientAccount");
    expect(accountSettingsSource).toContain("router.push('/(patient)/profile')");
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
    expect(source).toContain("setLogoutModalVisible(true)");
    expect(source).toContain("api.locations.listCommunesByWilaya");
    expect(source).toContain("أكمل ملفك الشخصي");
    expect(source).not.toContain("currentWilayaName");
    expect(source).toContain('value={profileEmail}');
    expect(source).toContain('email: email || undefined');
    expect(source).not.toContain("value={user.wilayaId ?? '-'}");
    expect(source).not.toContain("تعديل الملف الشخصي قيد التطوير");
    expect(source).not.toContain("ملفات العائلة قيد التطوير");
    expect(source).not.toContain("سيتم فتح صفحة سياسة الخصوصية قريباً");
  });

  test("profile action modal does not nest modal controls inside a pressable overlay", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/profile.tsx"),
      "utf8",
    );
    const modalSource = source.slice(
      source.indexOf("const ActionModal"),
      source.indexOf("// =============================================================================\n// Family Profile Item"),
    );

    expect(modalSource).toContain("styles.modalBackdrop");
    expect(modalSource).toContain("styles.modalOverlay");
    expect(modalSource).not.toContain("<Pressable\n      style={styles.modalOverlay}");
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

  test("search tab has an official page header above the search controls", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );

    expect(source).toContain("styles.searchHeader");
    expect(source).toContain("DoctorHeader");
    expect(source).toContain("ابحث عن مختص");
    expect(source).toContain("styles.searchControls");
    expect(source).toContain("styles.searchGreetingTitle");
    expect(source).toContain("style={styles.searchHeroHeader}");
    expect(source).not.toContain("styles.searchGreetingEyebrow");
    expect(source).toContain("flexDirection: 'row-reverse'");
    expect(source).not.toContain("style={styles.chipsRow}");
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

  test("search ignores legacy numeric specialty route params before querying Convex", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );

    expect(source).toContain("routeParamAllowedValue");
    expect(source).toContain("specialtyOptions.map((specialty) => specialty.id");
    expect(source).not.toContain(
      "useState<\n    Id<'specialties'> | undefined\n  >((specialtyParam ?? undefined) as Id<'specialties'> | undefined)",
    );
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

  test("search relies on backend-filtered results instead of client-side doctor filtering", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );

    expect(source).toContain("const doctorDataSource =");
    expect(source).toContain("const dataSource = searchMode === 'doctors' ? doctorDataSource : clinicResults");
    expect(source).toContain("const doctors = (doctorDataSource ?? []) as any[]");
    expect(source).toContain("r.wilaya?.nameAr ?? ''");
    expect(source).not.toContain("filteredDoctors = useMemo");
    expect(source).not.toContain("dataSource.filter");
    expect(source).not.toContain("d.specialtyId !== selectedSpecialtyId");
    expect(source).not.toContain("nameHit");
    expect(source).not.toContain("specHit");
  });

  test("search filter controls keep search text and expose explicit toggles", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );
    const specialtyHandler = source.slice(
      source.indexOf("const handleSpecialtySelect"),
      source.indexOf("const handleWilayaSelect"),
    );
    const wilayaHandler = source.slice(
      source.indexOf("const handleWilayaSelect"),
      source.indexOf("const handleAvailableTodayToggle"),
    );

    expect(source).toContain("handleAvailableTodayToggle");
    expect(source).toContain("متاح اليوم");
    expect(source).not.toContain("setShowGenderPicker(true)");
    expect(source).not.toContain("handleGenderSelect");
    expect(source).not.toContain('title="اختر الجنس"');
    expect(source).not.toContain("genderOptions");
    expect(specialtyHandler).not.toContain("setSearchText");
    expect(wilayaHandler).not.toContain("setSearchText");
    expect(source).not.toContain("if (prev === null) return 'male'");
  });

  test("search filters collapse dynamically while scrolling results", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/search.tsx"),
      "utf8",
    );

    expect(source).toContain("const searchListHeader = (");
    expect(source).toContain("ListHeaderComponent={searchListHeader}");
    expect(source).toContain("ListEmptyComponent");
    expect(source).toContain("filtersCollapsed");
    expect(source).toContain("setFiltersCollapsed");
    expect(source).toContain("lastResultsScrollYRef");
    expect(source).toContain("handleResultsScroll");
    expect(source).toContain("onScroll={handleResultsScroll}");
    expect(source).toContain("scrollEventThrottle={16}");
    expect(source).not.toContain("إظهار الفلاتر");
    expect(source).toContain("activeFiltersCount");
  });

  test("doctor details can add or remove the doctor from favorites", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );

    expect(source).toContain("api.doctors.toggleFavorite");
    expect(source).toContain("api.doctors.isFavorite");
    expect(source).toContain("favoriteOverride");
    expect(source).toContain("setFavoriteOverride(result.isFavorite)");
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

  test("doctor details expose a clinic Google Maps action", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );

    expect(source).toContain("Linking.openURL");
    expect(source).toContain("getClinicMapUrl");
    expect(source).toContain("اذهب إلى المركز");
    expect(source).toContain("clinic.mapUrl");
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
    expect(source).toContain("أكمل ملفك الشخصي");
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
    expect(source).toContain("getBookingDayOfWeek");
    expect(source).not.toContain("getUTCDay()");
  });

  test("appointment delay carries the original booking into reschedule confirmation", () => {
    const appointmentsSource = readFileSync(
      join(process.cwd(), "app/(patient)/appointments.tsx"),
      "utf8",
    );
    const datetimeSource = readFileSync(
      join(process.cwd(), "app/(patient)/booking/datetime.tsx"),
      "utf8",
    );
    const profileSource = readFileSync(
      join(process.cwd(), "app/(patient)/booking/profile.tsx"),
      "utf8",
    );
    const confirmSource = readFileSync(
      join(process.cwd(), "app/(patient)/booking/confirm.tsx"),
      "utf8",
    );
    const alertDelayAction = appointmentsSource.slice(
      appointmentsSource.indexOf("text: 'تأجيل الموعد'"),
      appointmentsSource.indexOf("{ text: 'إغلاق'", appointmentsSource.indexOf("text: 'تأجيل الموعد'")),
    );
    const cardDelayAction = appointmentsSource.slice(
      appointmentsSource.indexOf("const handleReschedule"),
      appointmentsSource.indexOf("const handleBookAgain"),
    );

    expect(alertDelayAction).toContain("rescheduleBookingId: item.id");
    expect(cardDelayAction).toContain("rescheduleBookingId: item.id");
    expect(datetimeSource).toContain("rescheduleBookingId?: string | string[]");
    expect(datetimeSource).toContain(
      "const rescheduleBookingId = routeParamString(params.rescheduleBookingId);",
    );
    expect(datetimeSource).toContain("rescheduleBookingId,");
    expect(profileSource).toContain("rescheduleBookingId?: string | string[]");
    expect(profileSource).toContain(
      "const rescheduleBookingId = routeParamString(params.rescheduleBookingId);",
    );
    expect(profileSource).toContain("rescheduleBookingId,");
    expect(confirmSource).toContain("api.bookings.reschedule");
    expect(confirmSource).toContain(
      "const bookingId = rescheduleBookingId",
    );
    expect(confirmSource).toContain(
      "bookingId: rescheduleBookingId as Id<'bookings'>",
    );
  });

  test("booking flow blocks incomplete patient profiles before createBooking", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/booking/confirm.tsx"),
      "utf8",
    );

    expect(source).toContain("me.profile");
    expect(source).toContain("أكمل ملفك الشخصي");
    expect(source).toContain("getArabicErrorMessage");
    expect(source).not.toContain("Patient profile not found");
  });

  test("booking confirmation sends patients back when a selected slot is now in the past", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(patient)/booking/confirm.tsx"),
      "utf8",
    );

    expect(source).toContain("slot_in_past");
    expect(source).toContain("هذا الوقت أصبح غير متاح");
    expect(source).toContain("العودة لاختيار وقت آخر");
  });

  test("patient booking flow does not show financial copy", () => {
    const doctorSource = readFileSync(
      join(process.cwd(), "app/(patient)/doctor/[id].tsx"),
      "utf8",
    );
    const confirmSource = readFileSync(
      join(process.cwd(), "app/(patient)/booking/confirm.tsx"),
      "utf8",
    );

    expect(doctorSource).not.toContain("PricingSection");
    expect(doctorSource).not.toContain("formatFee");
    expect(doctorSource).not.toContain("الأسعار");
    expect(doctorSource).not.toContain("الكشفية");
    expect(doctorSource).not.toContain("د.ج");
    expect(confirmSource).not.toContain("FeeRow");
    expect(confirmSource).not.toContain("رسوم الكشف");
    expect(confirmSource).not.toContain("د.ج");
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
