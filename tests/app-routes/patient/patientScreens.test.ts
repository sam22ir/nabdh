import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("patient screens use backend data", () => {
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
    expect(homeSource).toContain("s.nameAr");
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
    expect(source).toContain("styles.headerIcon");
    expect(source).toContain("ابحث عن طبيب");
    expect(source).toContain("اختر التخصص والولاية ثم قارن الأطباء المتاحين.");
    expect(source).toContain("styles.searchControls");
    expect(source).toContain("styles.headerMeta");
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

    expect(source).toContain("const doctors = dataSource ?? []");
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
      source.indexOf("const handleGenderSelect"),
    );

    expect(source).toContain("setShowGenderPicker(true)");
    expect(source).toContain("handleGenderSelect");
    expect(source).toContain("handleAvailableTodayToggle");
    expect(source).toContain("متاح اليوم");
    expect(source).toContain('title="اختر الجنس"');
    expect(source).toContain("genderOptions");
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
    expect(source).toContain("إظهار الفلاتر");
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
