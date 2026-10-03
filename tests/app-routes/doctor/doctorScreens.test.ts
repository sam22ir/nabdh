import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("doctor screens use backend data", () => {
  test("doctor tab shell uses the official restrained product theme", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/_layout.tsx"),
      "utf8",
    );

    expect(source).toContain("@/lib/theme");
    expect(source).toContain("theme.colors.official");
    expect(source).toContain("theme.colors.textMuted");
    expect(source).toContain("tabBarLabelStyle");
    expect(source).not.toContain("direction:");
    expect(source).not.toContain("writingDirection:");
    expect(source).toContain("height: 76");
    expect(source).toContain("lineHeight: 14");
  });

  test("doctor tabs use the operational redesign primitives", () => {
    const routes = [
      "dashboard",
      "appointments",
      "profile",
      "settings",
    ] as const;

    for (const route of routes) {
      const source = readFileSync(
        join(process.cwd(), `app/(doctor)/${route}.tsx`),
        "utf8",
      );

      expect(source, route).toContain("@/components/doctor-ui");
      expect(source, route).toContain("DoctorHeader");
      expect(source, route).toContain("DoctorSection");
    }
  });

  test("doctor dashboard exposes the operational command-center structure", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );

    expect(source).toContain("MetricStrip");
    expect(source).toContain("AppointmentWorkItem");
    expect(source).toContain("dashboardDatePill");
    expect(source).toContain("قائمة عملاء اليوم");
    expect(source).not.toContain("قائمة تشغيل اليوم");
  });

  test("doctor dashboard supports searching clinics and handling membership requests", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );

    expect(source).toContain("usePaginatedQuery");
    expect(source).toContain("useMutation, usePaginatedQuery, useQuery");
    expect(source).toContain("api.clinics.listPublic");
    expect(source).toContain("api.clinicMemberships.getMyAcceptedClinic");
    expect(source).toContain("api.clinicMemberships.listMyDoctorInvites");
    expect(source).toContain("api.clinicMemberships.listMyDoctorRequests");
    expect(source).toContain("api.clinicMemberships.requestToJoinClinic");
    expect(source).toContain("api.clinicMemberships.leaveClinic");
    expect(source).toContain("SegmentedControl");
    expect(source).toContain("SearchBar");
    expect(source).toContain("طلب الانضمام");
    expect(source).toContain("قبول الدعوة");
    expect(source).toContain("إلغاء الطلب");
  });

  test("doctor dashboard uses a purpose-built empty state for today's patient list", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );

    expect(source).toContain("TodayPatientsEmptyState");
    expect(source).toContain("styles.todayEmptyPanel");
    expect(source).toContain("checkmark-done-outline");
    expect(source).toContain("لا توجد مواعيد متبقية اليوم");
    expect(source).toContain("ستظهر المواعيد القادمة هنا تلقائياً عند تأكيد الحجز.");
    expect(source).not.toContain('icon="📅"');
  });

  test("doctor dashboard header is personalized and keeps the date separate", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );
    const primitiveSource = readFileSync(
      join(process.cwd(), "src/components/doctor-ui.tsx"),
      "utf8",
    );
    const dashboardHeaderSource = dashboardSource.slice(
      dashboardSource.indexOf("<DoctorHeader"),
      dashboardSource.indexOf("<MetricStrip"),
    );

    expect(dashboardSource).toContain("me.fullName ?? 'المختص'");
    expect(dashboardSource).toContain("titleContent=");
    expect(dashboardSource).toContain('<Text style={styles.dashboardGreetingHello}>مرحباً</Text>');
    expect(dashboardSource).toContain("{doctorTitleName}");
    expect(dashboardSource).not.toContain('title={`مرحباً، د. ${doctorTitleName}`}');
    expect(dashboardSource).not.toContain("getGreeting");
    expect(dashboardSource).not.toContain("صباح الخير");
    expect(dashboardSource).not.toContain("مساء الخير");
    expect(dashboardHeaderSource).not.toContain("action=");
    expect(dashboardHeaderSource).toContain("styles.dashboardDatePanel");
    expect(dashboardHeaderSource.indexOf("<DoctorHeader")).toBeLessThan(
      dashboardHeaderSource.indexOf("styles.dashboardDatePanel"),
    );
    expect(dashboardSource).toContain("dashboardDatePill");
    expect(dashboardSource).toContain("dashboardDatePanel");
    expect(dashboardSource).toContain("dashboardGreetingName");
    expect(primitiveSource).toContain("titleContent?: React.ReactNode");
    expect(dashboardSource).toContain("{todayArabic}");
    expect(dashboardSource).not.toContain('eyebrow="مركز اليوم"');
    expect(dashboardSource).not.toContain("راقب قائمة تشغيل اليوم وحدد العميل القادم بسرعة");
    expect(dashboardSource).toContain("showIcon={false}");
    expect(primitiveSource).toContain("showIcon?: boolean");
    expect(primitiveSource).toContain("showIcon &&");
  });

  test("doctor appointments exposes worklist filters and dense rows", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("SegmentedControl");
    expect(source).toContain("AppointmentWorkItem");
    expect(source).toContain("قائمة المواعيد");
    expect(source).not.toContain('eyebrow="قائمة المواعيد"');
    expect(source).toContain("showIcon={false}");
    expect(source).toContain("فرز حسب الفترة");
  });

  test("doctor profile exposes public trust and completion sections", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("MetricStrip");
    expect(source).not.toContain("جاهزية الملف العام");
    expect(source).not.toContain("اكتملت ${completionStats.complete}");
    expect(source).not.toContain("بيانات عامة. بيانات الثقة العامة تظهر للعملاء");
    expect(source).not.toContain("fullNameFr");
    expect(source).not.toContain("الاسم الكامل (فرنسي)");
    expect(source).not.toContain("bioFr");
    expect(source).not.toContain("السيرة الذاتية (فرنسي)");
    expect(source).not.toContain("Votre parcours professionnel");
    expect(source).toContain('label="وصف قصير"');
    expect(source).toContain("الوصف القصير يجب أن لا يتجاوز 120 حرفاً");
    expect(source).toContain("مثال: مختص مختص بخبرة في المتابعة اليومية");
    expect(source).not.toContain("السيرة الذاتية (عربي)");
    expect(source).not.toContain("نبذة عن مسيرتك المهنية");
    expect(source).not.toContain("subSpecialties");
    expect(source).not.toContain("التخصصات الفرعية");
    expect(source).not.toContain("LANGUAGES_OPTIONS");
    expect(source).not.toContain("LanguageChips");
    expect(source).not.toContain('name="languages"');
    expect(source).not.toContain("اللغات");
    expect(source).not.toContain("language-outline");
    expect(source).toContain("label: 'حالة اكتمال الملف الشخصي'");
    expect(source).toContain("progressValue: completionStats.percent");
    expect(source).toContain("completionChecks");
    expect(source).toContain("Boolean(profile.user.fullNameAr?.trim())");
    expect(source).toContain("Boolean(profile.user.email?.trim())");
    expect(source).toContain("Boolean(profile.user.phone?.trim())");
    expect(source).toContain("Boolean(profile.specialtyId)");
    expect(source).toContain("Boolean(profile.bioAr?.trim())");
    expect(source).toContain("profile.yearsOfExperience > 0");
    expect(source).toContain("profile.consultationFee !== undefined && profile.consultationFee !== null");
    expect(source).toContain("profile.followUpFee !== undefined && profile.followUpFee !== null");
    expect(source).not.toContain("activeClinics.length > 0");
    expect(source).toContain("total: 8");
    expect(source).not.toContain("label: 'profile completion status'");
    expect(source).not.toContain("label: 'جاهزية'");
    expect(source).not.toContain("label: 'خبرة'");
    expect(source).not.toContain("ribbon-outline");
    expect(source).toContain('label="الاسم"');
    expect(source).not.toContain('label="the name"');
    expect(source).not.toContain("الاسم الكامل (عربي)");
    expect(source).not.toContain("orderRegistrationNumber");
    expect(source).not.toContain('label="رقم شهادة التخرج (اختياري)"');
    expect(source).not.toContain("الرقم المرجعي الموجود على شهادة التخرج");
    expect(source).not.toContain("رقم شهادة التخرج");
    expect(source).toContain("optionalFeeSchema");
    expect(source).toContain("consultationFee: data.consultationFee ?? null");
    expect(source).toContain("followUpFee: data.followUpFee ?? null");
    expect(source).not.toContain('title="الأسعار"');
    expect(source).not.toContain('subtitle="تظهر الرسوم بوضوح قبل اختيار الموعد"');
    expect(source).not.toContain('label="رسوم الاستشارة (د.ج)"');
    expect(source).not.toContain('label="رسوم المتابعة (د.ج)"');
    expect(source).not.toContain("profile.consultationFee >= 0");
    expect(source).not.toContain("نحتاج التخصص ورقم التسجيل في النقابة");
    expect(source).toContain("centerTitle");
    expect(source).toContain('title="المعلومات الشخصية"');
    expect(source).not.toContain('title="personal information"');
    expect(source).toContain("email: optionalEmailSchema");
    expect(source).toContain('name="email"');
    expect(source).toContain('label="البريد الإلكتروني"');
    expect(source).toContain("keyboardType=\"email-address\"");
    expect(source).toContain("email: profile.user.email ?? ''");
    expect(source).toContain("email: data.email");
    expect(source).toContain("registerProfileFieldLayout('email')");
    expect(source).not.toContain("للقراءة فقط");
    expect(source).not.toContain("emailDisplayRow");
    expect(source).not.toContain("بيانات الثقة العامة");
    expect(source).not.toContain("الاسم، الهاتف، والتخصص هي أول إشارات يراجعها العميل");
    expect(source).toContain("PROFILE_FIELD_ORDER");
    expect(source).toContain("profileScrollRef.current?.scrollTo");
    expect(source).toContain("registerProfileFieldLayout('fullNameAr')");
    expect(source).toContain("registerProfileFieldLayout('specialtyId')");
    expect(source).toContain("setFocus(fieldName as any)");
    expect(source).toContain("setSpecialtyPickerVisible(true)");
    expect(source).toContain("handleSubmit(onSave, handleProfileInvalid)");
    expect(source).toContain("fieldLabel: {");
    expect(source).toContain("textAlign: 'right'");
    expect(source).toContain("writingDirection: 'rtl'");
  });

  test("doctor metric strip supports RTL completion progress", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/doctor-ui.tsx"),
      "utf8",
    );

    expect(source).toContain("progressValue?: number");
    expect(source).toContain("function getMetricProgressTone");
    expect(source).toContain("value <= 20");
    expect(source).toContain("value < 80");
    expect(source).toContain("styles.metricHeaderRow");
    expect(source).toContain("styles.metricProgressRow");
    expect(source).toContain("styles.metricValueRow");
    expect(source).toContain("styles.metricProgressTrack");
    expect(source).toContain("alignItems: 'flex-end'");
    expect(source).toContain("flexDirection: 'row-reverse'");
    expect(source).toContain("width: `${progressValue}%`");
  });

  test("doctor sections keep Arabic headers on the right", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/doctor-ui.tsx"),
      "utf8",
    );

    expect(source).toContain("sectionHeader: {");
    expect(source).toContain("flexDirection: 'row-reverse'");
    expect(source).toContain("justifyContent: 'flex-start'");
    expect(source).toContain("flexShrink: 1");
    expect(source).toContain("maxWidth: '100%'");
    expect(source).toContain("textAlign: 'right'");
    expect(source).toContain("writingDirection: 'rtl'");
  });

  test("doctor settings keeps only account access and logout after moving alerts to clinic", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );

    expect(source).not.toContain("إعدادات الإشعارات");
    expect(source).not.toContain("alertsExpanded");
    expect(source).toContain('label="إعدادات الحساب"');
    expect(source).toContain("تسجيل الخروج");
    expect(source).not.toContain(">الحجز</Text>");
    expect(source).not.toContain("policyExpanded");
    expect(source).not.toContain("التأكيد التلقائي للحجوزات");
    expect(source).not.toContain("الحد الأدنى لإشعار الإلغاء");
    expect(source).not.toContain("SegmentedControl");
  });

  test("doctor settings links account settings to a hidden dedicated page", () => {
    const settingsSource = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );
    const layoutSource = readFileSync(
      join(process.cwd(), "app/(doctor)/_layout.tsx"),
      "utf8",
    );
    const accountSettingsSource = readFileSync(
      join(process.cwd(), "app/(doctor)/account-settings.tsx"),
      "utf8",
    );

    expect(settingsSource).toContain('label="إعدادات الحساب"');
    expect(settingsSource).toContain("router.push('/(doctor)/account-settings')");
    expect(settingsSource).not.toContain('title="الحساب والخصوصية"');
    expect(settingsSource).not.toContain("privacyModalVisible");
    expect(layoutSource).toContain(
      '<Tabs.Screen name="account-settings" options={{ href: null }} />',
    );
    expect(accountSettingsSource).toContain("@/components/doctor-ui");
    expect(accountSettingsSource).toContain('title="إعدادات الحساب"');
    expect(accountSettingsSource).toContain("سياسة الخصوصية");
    expect(accountSettingsSource).toContain("حذف الحساب");
    expect(accountSettingsSource).toContain("api.users.deleteMyDoctorAccount");
    expect(accountSettingsSource).toContain("api.users.me");
    expect(accountSettingsSource).toContain("api.users.findAccountByIdentifier");
    expect(accountSettingsSource).toContain("useSignIn");
    expect(accountSettingsSource).toContain("buildClerkPasswordIdentifierFromLoginKey");
    expect(accountSettingsSource).toContain("enteredPhone === me?.phone");
    expect(accountSettingsSource).toContain("confirmPhoneInput");
    expect(accountSettingsSource).toContain("confirmPasswordInput");
    expect(accountSettingsSource).toContain("رقم الهاتف المسجل");
    expect(accountSettingsSource).toContain("كلمة المرور");
    expect(accountSettingsSource).toContain("signIn.create");
    expect(accountSettingsSource).toContain("رقم الهاتف أو كلمة المرور غير صحيحة");
    expect(accountSettingsSource).toContain("user?.delete()");
    expect(accountSettingsSource).toContain("setDeleteModalVisible(true)");
    expect(accountSettingsSource).toContain("router.push('/(doctor)/settings')");
  });

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

  test("profile no longer exposes clinic management controls", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/profile.tsx"),
      "utf8",
    );

    expect(source).not.toContain("api.clinics.create");
    expect(source).not.toContain("api.clinics.update");
    expect(source).not.toContain("api.clinics.delete_");
    expect(source).not.toContain("api.locations.listWilayas");
    expect(source).not.toContain("ClinicsManager");
    expect(source).not.toContain("clinicModalVisible");
    expect(source).not.toContain("handleSaveClinic");
    expect(source).not.toContain("handleEditClinic");
    expect(source).not.toContain("handleDeactivateClinic");
    expect(source).not.toContain("clinicMapInput");
    expect(source).not.toContain('title="المراكز"');
    expect(source).not.toContain("بيانات المراكز تحدد أين يمكن للعملاء الحجز");
  });

  test("profile specialty picker labels options from specialties.list display names", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("api.specialties.list");
    expect(source).toContain("nameAr: specialty.name");
    expect(source).not.toContain("nameFr: specialty.name");
    expect(source).not.toContain("pickerOptionSub");
    expect(source).not.toContain("nameAr: specialty.nameAr");
    expect(source).not.toContain("nameFr: specialty.nameFr");
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

  test("appointments patient filters are sent to Convex worklist queries", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("patientSearchText");
    expect(source).toContain("useDeferredValue");
    expect(source).toContain("deferredPatientSearchText");
    expect(source).toContain("selectedStatus");
    expect(source).toContain("selectedVisitType");
    expect(source).toContain("doctorAppointmentFilterArgs");
    expect(source).toContain("api.bookings.listDoctorToday");
    expect(source).toContain("api.bookings.listDoctorWeek");
    expect(source).toContain("api.bookings.listDoctorMonth");
    expect(source).toContain("query: normalizedPatientSearch || undefined");
    expect(source).toContain("const normalizedPatientSearch = deferredPatientSearchText.trim()");
    expect(source).not.toContain("const normalizedPatientSearch = patientSearchText.trim()");
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
    expect(source).toContain('keyboardDismissMode="none"');
    expect(source).toContain("blurOnSubmit={false}");
    expect(source).toContain("status: selectedStatus ?? undefined");
    expect(source).toContain("visitType: selectedVisitType ?? undefined");
    expect(source).toContain("ابحث باسم العميل أو رقم الهاتف");
    expect(source).toContain("حالة الموعد");
    expect(source).toContain("نوع الزيارة");
    expect(source).not.toContain("filteredAppointments");
    expect(source).not.toContain("patientName.includes");
  });

  test("appointments places patient filters directly under the header before period tabs", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );
    const renderSource = source.slice(
      source.indexOf("<DoctorHeader"),
      source.indexOf("{/* ─── Today Tab"),
    );

    expect(renderSource.indexOf("<DoctorHeader")).toBeLessThan(
      renderSource.indexOf("ابحث باسم العميل أو رقم الهاتف"),
    );
    expect(renderSource).not.toContain('title="فلترة العملاء"');
    expect(renderSource).not.toContain("ابحث وفلتر حسب الحالة، نوع الزيارة، والفترة");
    expect(renderSource).not.toContain("ثم ضيق النتائج حسب الحالة أو نوع الزيارة");
    expect(renderSource.indexOf("ابحث باسم العميل أو رقم الهاتف")).toBeLessThan(
      renderSource.indexOf('title="فرز حسب الفترة"'),
    );
    expect(renderSource.indexOf('title="فرز حسب الفترة"')).toBeLessThan(
      renderSource.indexOf('title="قائمة المواعيد"'),
    );
  });

  test("appointments moves status and visit filters into a bottom sheet opened from search", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );
    const betweenSearchAndPeriod = source.slice(
      source.indexOf("patientSearchBox"),
      source.indexOf('<DoctorSection title="فرز حسب الفترة"'),
    );

    expect(source).toContain("filterSheetVisible");
    expect(source).toContain("draftSelectedStatus");
    expect(source).toContain("draftSelectedVisitType");
    expect(source).toContain('accessibilityLabel="فتح فلاتر العملاء"');
    expect(source).toContain("styles.searchFilterButton");
    expect(source).toContain("styles.filterSheet");
    expect(source).toContain("FilterChipGroup");
    expect(source).toContain("styles.filterChipGrid");
    expect(source).toContain("تطبيق الفلاتر");
    expect(source).toContain("مسح الفلاتر");
    expect(betweenSearchAndPeriod).not.toContain("filterGroup");
    expect(betweenSearchAndPeriod).not.toContain("STATUS_FILTER_OPTIONS");
    expect(betweenSearchAndPeriod).not.toContain("VISIT_TYPE_FILTER_OPTIONS");
  });

  test("appointments filter sheet wraps filter chips instead of squeezing one row", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );
    const filterSheetSource = source.slice(
      source.indexOf("visible={filterSheetVisible}"),
      source.indexOf("<View style={styles.filterSheetActions}>"),
    );

    expect(filterSheetSource).toContain("FilterChipGroup");
    expect(filterSheetSource).not.toContain("<SegmentedControl");
    expect(source).toContain("flexWrap: 'wrap'");
    expect(source).toContain("filterChipButton");
    expect(source).toContain("filterChipButtonActive");
  });

  test("appointments search keeps the screen mounted while filtered queries refresh", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("useLatestDefinedQueryResult");
    expect(source).toContain("stableTodayData");
    expect(source).toContain("stableWeekData");
    expect(source).toContain("stableMonthData");
    expect(source).toContain("const isInitialLoading =");
    expect(source).toContain("if (isInitialLoading) {");
    expect(source).not.toContain(
      "if (todayData === undefined || weekData === undefined || monthData === undefined)",
    );
  });

  test("doctor screens label confirmed bookings as waiting in the worklist", () => {
    const appointmentsSource = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );
    const dashboardSource = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );

    expect(appointmentsSource).toContain("label: 'في الانتظار'");
    expect(dashboardSource).toContain("label: 'في الانتظار'");
    expect(appointmentsSource).toContain("{ key: 'confirmed', label: STATUS_CONFIG.confirmed.label");
    expect(dashboardSource).toContain("أول موعد في الانتظار يحتاج انتباهك الآن");
    expect(dashboardSource).toContain("المواعيد في الانتظار والمكتملة مرتبة حسب الوقت");
    expect(appointmentsSource).not.toContain("label: 'مؤكد'");
    expect(dashboardSource).not.toContain("label: 'مؤكد'");
    expect(dashboardSource).not.toContain("قائمة تشغيل اليوم");
  });

  test("doctor dashboard modal uses completed wording for the completion action", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );

    expect(source).toContain('accessibilityLabel="مكتمل"');
    expect(source).toContain("<Text style={styles.modalActionText}>مكتمل</Text>");
    expect(source).not.toContain("تأكيد الحضور");
  });

  test("doctor dashboard modal has a real cancel action separate from no-show", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );

    expect(source).toContain("api.bookings.cancel");
    expect(source).toContain("onCancelAppointment");
    expect(source).toContain("handleCancelAppointment");
    expect(source).toContain("const [cancelReason, setCancelReason] = useState('')");
    expect(source).toContain("handleConfirmCancel");
    expect(source).toContain("status: 'cancelled' as AppointmentStatus");
    expect(source).toContain('accessibilityLabel="إلغاء الموعد"');
    expect(source).toContain("<Text style={styles.modalCancelActionText}>إلغاء الموعد</Text>");
    expect(source).toContain('placeholder="اكتب سبب الإلغاء..."');
    expect(source).toContain("disabled={!cancelReason.trim()}");
    expect(source).toContain("onCancelAppointment(appointment.id, cancelReason.trim())");
    expect(source).toContain("cancellationReason: reason");
    expect(source).not.toContain("cancellationReason: 'إلغاء من المختص'");
    expect(source).toContain("status: 'no_show' as AppointmentStatus");
  });

  test("doctor dashboard cancel reason form replaces action buttons in the visible action area", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );
    const modalSource = source.slice(
      source.indexOf("const AppointmentDetailModal"),
      source.indexOf("// ── Detail Row"),
    );

    expect(modalSource).toContain("showCancelReason ? (");
    expect(modalSource).toContain(") : (");
    expect(modalSource.indexOf("showCancelReason ? (")).toBeLessThan(
      modalSource.indexOf("<View style={styles.modalActionRow}>"),
    );
    expect(modalSource.indexOf("showCancelReason ? (")).toBeLessThan(
      modalSource.indexOf("<Text style={styles.modalCancelActionText}>إلغاء الموعد</Text>"),
    );
  });

  test("doctor dashboard modal places appointment actions under the doctor note", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );
    const modalSource = source.slice(
      source.indexOf("const AppointmentDetailModal"),
      source.indexOf("// ── Detail Row"),
    );

    expect(modalSource.indexOf("{/* Doctor note */}")).toBeGreaterThan(-1);
    expect(modalSource.indexOf("{/* Actions for confirmed appointments */}")).toBeGreaterThan(-1);
    expect(modalSource.indexOf("{/* Doctor note */}")).toBeLessThan(
      modalSource.indexOf("{/* Actions for confirmed appointments */}"),
    );
  });

  test("doctor dashboard modal lays appointment actions side by side", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );
    const actionStylesSource = source.slice(
      source.indexOf("modalActionRow:"),
      source.indexOf("modalActionCompleted:"),
    );

    expect(source).toContain("<View style={styles.modalActionRow}>");
    expect(actionStylesSource).toContain("flexDirection: 'row'");
    expect(actionStylesSource).toContain("gap: theme.spacing.sm");
    expect(actionStylesSource).toContain("flex: 1");
  });

  test("appointments month selected day stays synced with Convex updates", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("selectedDayDate");
    expect(source).toContain("setSelectedDayDate(dateStr)");
    expect(source).toContain("monthAppointmentsByDate.get(selectedDayDate)");
    expect(source).toContain("updatedAppointments.length > 0 ? updatedAppointments : null");
  });

  test("appointments patient filters stay stable while scrolling the worklist", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );
    const renderSource = source.slice(
      source.indexOf("return (\n    <SafeAreaView"),
      source.indexOf("// =============================================================================\n// Styles"),
    );

    expect(source).not.toContain("filtersCollapsed");
    expect(source).not.toContain("setFiltersCollapsed");
    expect(source).not.toContain("lastWorklistScrollYRef");
    expect(source).not.toContain("handleWorklistScroll");
    expect(source).not.toContain("onScroll={handleWorklistScroll}");
    expect(source).not.toContain("scrollEventThrottle={16}");
    expect(source).not.toContain("إظهار الفلاتر");
    expect(source).toContain("activeFilterCount");
    expect(renderSource.indexOf("<ScrollView")).toBeLessThan(
      renderSource.indexOf("<DoctorHeader"),
    );
  });

  test("appointments week view uses backend Sunday-start boundaries", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("@/lib/doctorAppointmentWeeks");
    expect(source).toContain("buildDoctorWeekSections");
    expect(source).toContain("startDate: stableWeekData.startDate");
    expect(source).toContain("endDate: stableWeekData.endDate");
    expect(source).not.toContain("diffToMonday");
    expect(source).not.toContain("Monday start");
  });

  test("appointments week auto-expand does not reopen today after manual collapse", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("autoExpandedWeekDateRef");
    expect(source).toContain("autoExpandedWeekDateRef.current === todayDate");
    expect(source).toContain("autoExpandedWeekDateRef.current = todayDate");
    expect(source).not.toContain("}, [weekSections, expandedDates, todayDate]);");
  });

  test("schedule route is removed from the doctor tab bar", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/_layout.tsx"),
      "utf8",
    );

    expect(source).not.toContain('<Tabs.Screen name="schedule" />');
    expect(source).not.toContain('schedule: "calendar"');
    expect(source).not.toContain('schedule: "الجدول"');
  });

  test("settings keeps logout modal local and moves privacy into account settings", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );
    const accountSettingsSource = readFileSync(
      join(process.cwd(), "app/(doctor)/account-settings.tsx"),
      "utf8",
    );

    expect(source).toContain("router.push('/(doctor)/account-settings')");
    expect(source).toContain("setLogoutModalVisible(true)");
    expect(source).not.toContain("privacyModalVisible");
    expect(source).toContain("logoutModalVisible");
    expect(accountSettingsSource).toContain("سياسة الخصوصية");
  });

  test("settings controls are persisted instead of local-only state", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );

    expect(source).not.toContain("useDoctorSettingsStore");
    expect(source).not.toContain("setNewBookingAlerts");
    expect(source).not.toContain("setCancellationAlerts");
    expect(source).not.toContain("setDailySummary");
    expect(source).not.toContain("setMinCancelHours");
    expect(source).not.toContain("const [newBookingAlerts");
    expect(source).not.toContain("const [cancellationAlerts");
    expect(source).not.toContain("const [dailySummary");
    expect(source).not.toContain("const [minCancelHours");
  });
});
