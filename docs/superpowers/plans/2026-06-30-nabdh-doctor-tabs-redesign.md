# Nabdh Doctor Tabs Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved operational doctor-tabs redesign first, then stop and show the doctor tabs before touching patient tabs.

**Architecture:** Keep the existing Expo SDK 56, Expo Router, Convex React hooks, Zustand, and `StyleSheet` architecture. Add focused shared doctor UI primitives for repeated layout/status patterns, then adapt the five doctor tab screens around those primitives without changing backend contracts.

**Tech Stack:** Expo SDK 56, React Native 0.85, Expo Router tabs, Convex React, TypeScript, Vitest route/source tests, Cairo/Inter fonts, Ionicons.

---

## Pre-Flight Rules

- Read `convex/_generated/ai/guidelines.md` before any Convex code or query changes. This plan should not require Convex backend edits.
- Use the official Expo v56 docs for Expo Router and SDK behavior: `https://docs.expo.dev/versions/v56.0.0/`.
- The worktree is already dirty. Before each task, run `git diff -- <files>` for that task and preserve unrelated existing edits.
- Do not redesign patient tabs in this phase. Only touch patient files if typecheck fails because of a shared type or theme change.
- Use `apply_patch` for manual file edits.
- Make path-limited commits per task so unrelated dirty files stay unstaged.

## File Structure

- Modify: `src/lib/theme.ts` for doctor-specific neutral/official tokens only if missing.
- Modify: `src/components/ui.tsx` for shared primitives used by both current redesign and doctor screens.
- Create: `src/components/doctor-ui.tsx` for doctor-specific presentational primitives.
- Modify: `tests/app-routes/doctor/doctorScreens.test.ts` for route/source assertions that protect the doctor redesign.
- Modify: `src/lib/designSystem.test.ts` for shared primitive assertions if new primitives live outside doctor routes.
- Modify: `app/(doctor)/_layout.tsx` for official tab color/style alignment.
- Modify: `app/(doctor)/dashboard.tsx` for today command center.
- Modify: `app/(doctor)/appointments.tsx` for appointment worklist.
- Modify: `app/(doctor)/schedule.tsx` for clinic-hours operations view.
- Modify: `app/(doctor)/profile.tsx` for profile completion/public trust layout.
- Modify: `app/(doctor)/settings.tsx` for quieter operational settings.
- Do not modify patient route files in this phase.

## Task 1: Shared Doctor UI Primitives

**Files:**
- Create: `src/components/doctor-ui.tsx`
- Modify: `src/lib/designSystem.test.ts`
- Modify if needed: `src/lib/theme.ts`

- [ ] **Step 1: Read current diffs for shared files**

Run:

```bash
git diff -- src/lib/theme.ts src/components/ui.tsx src/lib/designSystem.test.ts
```

Expected: output may include existing redesign edits. Preserve them.

- [ ] **Step 2: Write failing tests for doctor primitives**

Add these assertions inside `describe("Nabdh redesign system", () => { ... })` in `src/lib/designSystem.test.ts`:

```ts
  test("doctor operational primitives exist for the doctor tabs redesign", () => {
    const componentPath = join(process.cwd(), "src/components/doctor-ui.tsx");

    expect(existsSync(componentPath)).toBe(true);

    const source = readFileSync(componentPath, "utf8");
    expect(source).toContain("export function DoctorHeader");
    expect(source).toContain("export function MetricStrip");
    expect(source).toContain("export function SegmentedControl");
    expect(source).toContain("export function AppointmentWorkItem");
    expect(source).toContain("export function DoctorSection");
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/designSystem.test.ts
```

Expected: FAIL because `src/components/doctor-ui.tsx` does not exist or does not export the listed functions.

- [ ] **Step 4: Create `src/components/doctor-ui.tsx`**

Create the file with these exports:

```tsx
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';

type IconName = keyof typeof Ionicons.glyphMap;
type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface DoctorHeaderProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  icon?: IconName;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function DoctorHeader({
  title,
  subtitle,
  eyebrow,
  icon = 'calendar-outline',
  action,
  style,
}: DoctorHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.headerEyebrow}>{eyebrow}</Text> : null}
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIcon}>
            <Ionicons name={icon} size={19} color={theme.colors.white} />
          </View>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Text style={styles.headerSubtitle} numberOfLines={3}>
          {subtitle}
        </Text>
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export interface MetricItem {
  label: string;
  value: number | string;
  icon: IconName;
  tone?: BadgeTone;
}

interface MetricStripProps {
  items: MetricItem[];
}

export function MetricStrip({ items }: MetricStripProps) {
  return (
    <View style={styles.metricStrip}>
      {items.map((item) => {
        const tone = item.tone ?? 'neutral';
        const palette = theme.colors.status[tone];
        return (
          <View key={`${item.label}-${item.value}`} style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: palette.background }]}>
              <Ionicons name={item.icon} size={15} color={palette.text} />
            </View>
            <Text style={styles.metricValue} numberOfLines={1}>
              {item.value}
            </Text>
            <Text style={styles.metricLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && styles.segmentPressed,
            ]}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={14}
                color={active ? theme.colors.white : theme.colors.textSecondary}
              />
            ) : null}
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface AppointmentWorkItemProps {
  time: string;
  patientName: string;
  meta: string;
  statusLabel: string;
  tone?: BadgeTone;
  icon?: IconName;
  onPress?: () => void;
}

export function AppointmentWorkItem({
  time,
  patientName,
  meta,
  statusLabel,
  tone = 'neutral',
  icon = 'person-outline',
  onPress,
}: AppointmentWorkItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${time} ${patientName} ${statusLabel}`}
      style={({ pressed }) => [
        styles.workItem,
        pressed && onPress && styles.workItemPressed,
      ]}
    >
      <View style={styles.workTime}>
        <Text style={styles.workTimeText}>{time}</Text>
      </View>
      <View style={styles.workMain}>
        <View style={styles.workNameRow}>
          <Ionicons name={icon} size={15} color={theme.colors.primary} />
          <Text style={styles.workName} numberOfLines={1}>
            {patientName}
          </Text>
        </View>
        <Text style={styles.workMeta} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      <Badge label={statusLabel} tone={tone} />
    </Pressable>
  );
}

interface DoctorSectionProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function DoctorSection({
  title,
  subtitle,
  action,
  children,
  style,
}: DoctorSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {action ? <View>{action}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.official,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerEyebrow: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    lineHeight: 30,
    color: theme.colors.white,
    textAlign: rtlTextAlign(),
  },
  headerSubtitle: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.82)',
    textAlign: rtlTextAlign(),
  },
  headerAction: {
    paddingTop: theme.spacing.xs,
  },
  metricStrip: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  metricCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 20,
    color: theme.colors.official,
    textAlign: rtlTextAlign(),
  },
  metricLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  segmented: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  segmentPressed: {
    opacity: 0.82,
  },
  segmentText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: theme.colors.white,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sectionText: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  sectionSubtitle: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  workItem: {
    minHeight: 72,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  workItemPressed: {
    opacity: 0.9,
  },
  workTime: {
    width: 58,
    alignItems: 'flex-start',
  },
  workTimeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  workMain: {
    flex: 1,
    minWidth: 0,
  },
  workNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  workName: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  workMeta: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
});
```

- [ ] **Step 5: Run design system test**

Run:

```bash
npx vitest run src/lib/designSystem.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit shared primitives**

Run:

```bash
git add src/components/doctor-ui.tsx src/lib/designSystem.test.ts
git commit -m "feat: add doctor operational UI primitives" -- src/components/doctor-ui.tsx src/lib/designSystem.test.ts
```

## Task 2: Doctor Tab Shell Styling

**Files:**
- Modify: `app/(doctor)/_layout.tsx`
- Test: `tests/app-routes/doctor/doctorScreens.test.ts`

- [ ] **Step 1: Read current doctor layout**

Run:

```bash
git diff -- 'app/(doctor)/_layout.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

Expected: preserve route registration and auth guards.

- [ ] **Step 2: Write failing tab-style assertions**

Append to `tests/app-routes/doctor/doctorScreens.test.ts`:

```ts
  test("doctor tab bar uses the official operational visual system", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/_layout.tsx"),
      "utf8",
    );

    expect(source).toContain("theme.colors.primary");
    expect(source).toContain("theme.colors.textMuted");
    expect(source).toContain("theme.colors.surfaceRaised");
    expect(source).toContain("tabBarLabelStyle");
    expect(source).toContain("tabBarItemStyle");
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "doctor tab bar uses"
```

Expected: FAIL because the doctor layout still uses hardcoded colors.

- [ ] **Step 4: Update doctor layout imports and tab style**

In `app/(doctor)/_layout.tsx`, add:

```ts
import { theme } from "@/lib/theme";
```

Replace the hardcoded tab options with:

```tsx
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          direction: "rtl" as any,
          backgroundColor: theme.colors.surfaceRaised,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.arabicBold,
          fontSize: 11,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        headerShown: false,
```

Also replace the loading indicator color with:

```tsx
<ActivityIndicator size="large" color={theme.colors.primary} />
```

- [ ] **Step 5: Run doctor screen tests**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit tab shell**

Run:

```bash
git add 'app/(doctor)/_layout.tsx' tests/app-routes/doctor/doctorScreens.test.ts
git commit -m "feat: align doctor tab shell with redesign" -- 'app/(doctor)/_layout.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

## Task 3: Doctor Dashboard Command Center

**Files:**
- Modify: `app/(doctor)/dashboard.tsx`
- Modify: `tests/app-routes/doctor/doctorScreens.test.ts`

- [ ] **Step 1: Read current dashboard diff**

Run:

```bash
git diff -- 'app/(doctor)/dashboard.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

Expected: preserve existing Convex calls `api.bookings.getHomeDataDoctor`, `markCompleted`, `markNoShow`, and `updateDoctorNote`.

- [ ] **Step 2: Write failing dashboard redesign assertions**

Append to `tests/app-routes/doctor/doctorScreens.test.ts`:

```ts
  test("dashboard is a timeline-first doctor command center", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/dashboard.tsx"),
      "utf8",
    );

    expect(source).toContain("@/components/doctor-ui");
    expect(source).toContain("DoctorHeader");
    expect(source).toContain("MetricStrip");
    expect(source).toContain("AppointmentWorkItem");
    expect(source).toContain("جدول اليوم");
    expect(source).toContain("المريض التالي");
    expect(source).toContain("قائمة اليوم");
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "dashboard is a timeline-first"
```

Expected: FAIL until dashboard imports and copy are updated.

- [ ] **Step 4: Import doctor primitives**

Add to `app/(doctor)/dashboard.tsx`:

```ts
import {
  AppointmentWorkItem,
  DoctorHeader,
  DoctorSection,
  MetricStrip,
  type MetricItem,
} from '@/components/doctor-ui';
```

- [ ] **Step 5: Add status tone helpers**

Add near `STATUS_CONFIG`:

```ts
const STATUS_TONE: Record<AppointmentStatus, 'success' | 'danger' | 'warning' | 'neutral'> = {
  confirmed: 'success',
  cancelled: 'danger',
  completed: 'neutral',
  no_show: 'warning',
};

function appointmentMeta(appointment: DashboardAppointment): string {
  const reason = appointment.reason?.trim();
  const note = appointment.patientNote?.trim();
  const visitType = VISIT_TYPE_LABELS[appointment.visitType];
  if (reason) return `${visitType} - ${reason}`;
  if (note) return `${visitType} - ${note}`;
  return visitType;
}
```

- [ ] **Step 6: Replace top dashboard render with operational header and metrics**

Inside `DoctorDashboardScreen`, after derived appointment lists are computed, create:

```ts
  const metrics: MetricItem[] = useMemo(
    () => [
      {
        label: 'مواعيد اليوم',
        value: todayAppointments.length,
        icon: 'calendar-outline',
        tone: 'info',
      },
      {
        label: 'مؤكدة',
        value: todayAppointments.filter((a) => a.status === 'confirmed').length,
        icon: 'checkmark-circle-outline',
        tone: 'success',
      },
      {
        label: 'مكتملة',
        value: todayAppointments.filter((a) => a.status === 'completed').length,
        icon: 'checkmark-done-outline',
        tone: 'neutral',
      },
    ],
    [todayAppointments],
  );
```

Then replace the old greeting/stats header JSX with:

```tsx
        <DoctorHeader
          eyebrow={getGreeting()}
          title="جدول اليوم"
          subtitle={`${formatTodayArabic()} - راجع المريض التالي وقائمة المواعيد قبل بداية العمل.`}
          icon="calendar-outline"
        />

        <MetricStrip items={metrics} />
```

- [ ] **Step 7: Replace next-patient and today-list sections**

Use this structure in the main `ScrollView`:

```tsx
        <DoctorSection
          title="المريض التالي"
          subtitle="أول موعد مؤكد حسب وقت اليوم."
        >
          {nextAppointment ? (
            <NextPatientCard appointment={nextAppointment} />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="لا يوجد مريض تال"
              subtitle="لا توجد مواعيد مؤكدة متبقية في جدول اليوم."
            />
          )}
        </DoctorSection>

        <DoctorSection
          title="قائمة اليوم"
          subtitle="مرتبة حسب وقت الموعد مع حالة كل مريض."
        >
          {todayList.length > 0 ? (
            <View style={styles.timelineList}>
              {todayList.map((appointment) => (
                <AppointmentWorkItem
                  key={appointment.id}
                  time={appointment.appointmentTime}
                  patientName={appointment.patientName}
                  meta={appointmentMeta(appointment)}
                  statusLabel={STATUS_CONFIG[appointment.status].label}
                  tone={STATUS_TONE[appointment.status]}
                  onPress={() => setSelectedAppointment(appointment)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title="لا توجد مواعيد اليوم"
              subtitle="عند إضافة مواعيد جديدة ستظهر هنا مرتبة حسب الوقت."
            />
          )}
        </DoctorSection>
```

Add style:

```ts
  timelineList: {
    gap: theme.spacing.sm,
  },
```

- [ ] **Step 8: Run dashboard test**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "dashboard"
```

Expected: PASS.

- [ ] **Step 9: Commit dashboard**

Run:

```bash
git add 'app/(doctor)/dashboard.tsx' tests/app-routes/doctor/doctorScreens.test.ts
git commit -m "feat: redesign doctor dashboard command center" -- 'app/(doctor)/dashboard.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

## Task 4: Appointments Worklist

**Files:**
- Modify: `app/(doctor)/appointments.tsx`
- Modify: `tests/app-routes/doctor/doctorScreens.test.ts`

- [ ] **Step 1: Read current appointments diff**

Run:

```bash
git diff -- 'app/(doctor)/appointments.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

Expected: preserve current Convex queries and appointment mutations.

- [ ] **Step 2: Write failing worklist assertions**

Append to `tests/app-routes/doctor/doctorScreens.test.ts`:

```ts
  test("appointments tab uses segmented worklist primitives", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/appointments.tsx"),
      "utf8",
    );

    expect(source).toContain("@/components/doctor-ui");
    expect(source).toContain("DoctorHeader");
    expect(source).toContain("SegmentedControl");
    expect(source).toContain("AppointmentWorkItem");
    expect(source).toContain("سجل المواعيد");
    expect(source).toContain("قائمة العمل");
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "appointments tab uses"
```

Expected: FAIL until appointments screen uses the new primitives/copy.

- [ ] **Step 4: Import doctor primitives**

Add:

```ts
import {
  AppointmentWorkItem,
  DoctorHeader,
  DoctorSection,
  SegmentedControl,
  type SegmentOption,
} from '@/components/doctor-ui';
```

- [ ] **Step 5: Replace local `SegmentTabs` usage**

Keep the existing `ViewTab` and `TABS`, then add:

```ts
const SEGMENTS: SegmentOption<ViewTab>[] = TABS.map((tab) => ({
  key: tab.key,
  label: tab.label,
  icon: tab.icon,
}));
```

Replace:

```tsx
<SegmentTabs activeTab={activeTab} onTabChange={setActiveTab} />
```

with:

```tsx
<SegmentedControl
  options={SEGMENTS}
  value={activeTab}
  onChange={setActiveTab}
/>
```

- [ ] **Step 6: Add operational header**

At the top of the main render, before the segmented control:

```tsx
      <DoctorHeader
        title="سجل المواعيد"
        subtitle="قائمة عمل لتصفية المواعيد، فتح التفاصيل، وتحديث حالة كل موعد بسرعة."
        icon="calendar-outline"
      />
```

- [ ] **Step 7: Render today rows with `AppointmentWorkItem`**

In the today item renderer, use:

```tsx
<AppointmentWorkItem
  time={item.appointmentTime}
  patientName={item.patientName}
  meta={appointmentMeta(item)}
  statusLabel={STATUS_CONFIG[item.status].label}
  tone={STATUS_TONE[item.status]}
  onPress={() => handleAppointmentPress(item)}
/>
```

Add helpers if missing:

```ts
const STATUS_TONE: Record<AppointmentStatus, 'success' | 'danger' | 'warning' | 'neutral'> = {
  confirmed: 'success',
  cancelled: 'danger',
  completed: 'neutral',
  no_show: 'warning',
};

function appointmentMeta(appointment: DashboardAppointment): string {
  const visitType = VISIT_TYPE_LABELS[appointment.visitType];
  const reason = appointment.reason?.trim();
  if (reason) return `${visitType} - ${reason}`;
  return visitType;
}
```

- [ ] **Step 8: Add the worklist section label for all views**

Immediately above the branch that renders today, week, or month content, add:

```tsx
      <DoctorSection
        title="قائمة العمل"
        subtitle="كل موعد يعرض الوقت، المريض، نوع الزيارة، وحالة المتابعة."
      >
        <View style={styles.worklistFrame}>
          {activeTab === 'today' ? (
            renderTodayContent()
          ) : activeTab === 'week' ? (
            renderWeekContent()
          ) : (
            renderMonthContent()
          )}
        </View>
      </DoctorSection>
```

Create `renderTodayContent`, `renderWeekContent`, and `renderMonthContent` with `useCallback` only if the current screen does not already have small render branches. Move the current today `FlatList`, week `SectionList`, and month grid JSX into those functions without changing their data sources.

Add:

```ts
  worklistFrame: {
    gap: theme.spacing.sm,
  },
```

Keep the existing `SectionList` week grouping and month grid. Keep these existing strings or equivalents so old tests stay meaningful:

```tsx
<EmptyState
  icon="calendar-clear-outline"
  title="لا توجد مواعيد"
  subtitle="لا توجد مواعيد في الفترة المحددة."
/>
```

- [ ] **Step 9: Run appointments tests**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "appointments"
```

Expected: PASS.

- [ ] **Step 10: Commit appointments**

Run:

```bash
git add 'app/(doctor)/appointments.tsx' tests/app-routes/doctor/doctorScreens.test.ts
git commit -m "feat: redesign doctor appointments worklist" -- 'app/(doctor)/appointments.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

## Task 5: Schedule Clinic-Hours Operations View

**Files:**
- Modify: `app/(doctor)/schedule.tsx`
- Modify: `tests/app-routes/doctor/doctorScreens.test.ts`

- [ ] **Step 1: Read current schedule diff**

Run:

```bash
git diff -- 'app/(doctor)/schedule.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

Expected: preserve `api.clinics.getMyClinics`, `api.schedules.getMySchedules`, `upsertDay`, exception mutations, and stable modal pickers.

- [ ] **Step 2: Write failing schedule redesign assertions**

Append to `tests/app-routes/doctor/doctorScreens.test.ts`:

```ts
  test("schedule tab presents clinic hours as an operations view", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/schedule.tsx"),
      "utf8",
    );

    expect(source).toContain("@/components/doctor-ui");
    expect(source).toContain("DoctorHeader");
    expect(source).toContain("DoctorSection");
    expect(source).toContain("إعداد أوقات العمل");
    expect(source).toContain("الأسبوع التشغيلي");
    expect(source).toContain("الاستثناءات");
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "schedule tab presents"
```

Expected: FAIL until schedule screen imports the primitives and copy.

- [ ] **Step 4: Import doctor primitives**

Add:

```ts
import { DoctorHeader, DoctorSection } from '@/components/doctor-ui';
```

- [ ] **Step 5: Add schedule header**

At the top of the main screen render:

```tsx
      <DoctorHeader
        title="إعداد أوقات العمل"
        subtitle="اضبط ساعات العيادات، مدة الموعد، عدد المرضى، والاستثناءات من شاشة واحدة."
        icon="time-outline"
      />
```

- [ ] **Step 6: Replace the old schedule header and wrap clinic cards**

Replace the old header:

```tsx
        <View style={styles.header}>
          <Text style={styles.headerTitle}>جدول المواعيد</Text>
        </View>
```

with:

```tsx
        <DoctorHeader
          title="إعداد أوقات العمل"
          subtitle="اضبط ساعات العيادات، مدة الموعد، عدد المرضى، والاستثناءات من شاشة واحدة."
          icon="time-outline"
        />
```

Replace the clinic schedule section:

```tsx
      <DoctorSection
        title="الأسبوع التشغيلي"
        subtitle="كل يوم يوضح حالة العمل والوقت وعدد المرضى."
      >
        {clinics.length > 0 ? (
          <View style={styles.daysList}>
            <FlatList
              data={clinics}
              renderItem={renderClinic}
              keyExtractor={clinicKeyExtractor}
              scrollEnabled={false}
            />
          </View>
        ) : (
          <EmptyState
            icon="business-outline"
            title="لا توجد عيادة"
            subtitle="أضف عيادة نشطة من ملفك حتى تتمكن من ضبط جدول العمل."
            action={{ label: 'إضافة عيادة', onPress: handleAddClinicPress }}
          />
        )}
      </DoctorSection>
```

Keep the current `ClinicCard`, `DayRow`, and handlers: `renderClinic`, `handleDayToggle`, `handleStartTimePress`, `handleEndTimePress`, `handleDurationPress`, and `handleMaxPatientsChange`.

- [ ] **Step 7: Wrap exceptions section**

Replace the current exceptions section with:

```tsx
      <DoctorSection
        title="الاستثناءات"
        subtitle="تواريخ مغلقة أو أوقات خاصة تظهر خارج الأسبوع المعتاد."
        action={
          <Pressable
            onPress={() => setExceptionModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="إضافة استثناء"
            style={styles.addExceptionButton}
          >
            <Ionicons name="add" size={16} color={theme.colors.white} />
            <Text style={styles.addExceptionText}>إضافة</Text>
          </Pressable>
        }
      >
        {exceptions.length > 0 ? (
          <View style={styles.exceptionsList}>
            <FlatList
              data={exceptions}
              renderItem={renderException}
              keyExtractor={exceptionKeyExtractor}
              scrollEnabled={false}
            />
          </View>
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="لا توجد استثناءات"
            subtitle="أضف تواريخ الإغلاق أو أوقات العمل الخاصة عند الحاجة."
          />
        )}
      </DoctorSection>
```

Add styles:

```ts
  daysList: {
    gap: theme.spacing.sm,
  },
  exceptionsList: {
    gap: theme.spacing.sm,
  },
  addExceptionButton: {
    minHeight: 36,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  addExceptionText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.white,
  },
```

- [ ] **Step 8: Run schedule tests**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "schedule"
```

Expected: PASS.

- [ ] **Step 9: Commit schedule**

Run:

```bash
git add 'app/(doctor)/schedule.tsx' tests/app-routes/doctor/doctorScreens.test.ts
git commit -m "feat: redesign doctor schedule operations view" -- 'app/(doctor)/schedule.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

## Task 6: Doctor Profile Public Trust Layout

**Files:**
- Modify: `app/(doctor)/profile.tsx`
- Modify: `tests/app-routes/doctor/doctorScreens.test.ts`

- [ ] **Step 1: Read current profile diff**

Run:

```bash
git diff -- 'app/(doctor)/profile.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

Expected: preserve Convex profile update, clinic management, completion repair, and validation behavior.

- [ ] **Step 2: Write failing profile redesign assertions**

Append to `tests/app-routes/doctor/doctorScreens.test.ts`:

```ts
  test("profile tab emphasizes public trust and completion", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/profile.tsx"),
      "utf8",
    );

    expect(source).toContain("@/components/doctor-ui");
    expect(source).toContain("DoctorHeader");
    expect(source).toContain("DoctorSection");
    expect(source).toContain("اكتمال الملف العام");
    expect(source).toContain("المعلومات المهنية");
    expect(source).toContain("العيادات والأسعار");
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "profile tab emphasizes"
```

Expected: FAIL until profile screen uses the new structure.

- [ ] **Step 4: Import doctor primitives**

Add:

```ts
import { DoctorHeader, DoctorSection } from '@/components/doctor-ui';
```

- [ ] **Step 5: Add completion helper**

Near the profile data helpers:

```ts
function getProfileCompletion(data: Partial<ProfileFormData>): number {
  const checks = [
    Boolean(data.fullNameAr?.trim()),
    Boolean(data.fullNameFr?.trim()),
    Boolean(data.phone?.trim()),
    Boolean(data.specialtyId?.trim()),
    Boolean(data.orderRegistrationNumber?.trim()),
    Boolean(data.languages && data.languages.length > 0),
    Number(data.consultationFee) >= 0,
    Number(data.followUpFee) >= 0,
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}
```

- [ ] **Step 6: Add profile header and completion panel**

In the main render before form sections:

```tsx
      <DoctorHeader
        title="ملفي الطبي"
        subtitle="حافظ على بياناتك العامة واضحة حتى يفهم المرضى التخصص، العيادة، الرسوم، وحالة التسجيل."
        icon="person-circle-outline"
      />

      <DoctorSection
        title="اكتمال الملف العام"
        subtitle="البيانات المكتملة تساعد المرضى على اتخاذ قرار الحجز بثقة."
      >
        <View style={styles.completionPanel}>
          <View style={styles.completionTopRow}>
            <Text style={styles.completionValue}>
              {getProfileCompletion(watchedValues)}%
            </Text>
            <Text style={styles.completionLabel}>مكتمل</Text>
          </View>
          <View style={styles.completionTrack}>
            <View
              style={[
                styles.completionFill,
                { width: `${getProfileCompletion(watchedValues)}%` },
              ]}
            />
          </View>
        </View>
      </DoctorSection>
```

If the screen does not currently expose `watchedValues`, add:

```ts
  const watchedValues = watch();
```

Use the existing `watch` returned by `useForm`. If the current `useForm` destructuring does not include `watch`, change it from:

```ts
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
```

to:

```ts
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
```

- [ ] **Step 7: Rename and group visible sections**

Replace the section containers in the returned JSX as follows. Keep the existing `Controller`, `FormField`, `SpecialtyPicker`, `LanguageChips`, fee inputs, and `ClinicsManager` children inside these wrappers.

```tsx
      <DoctorSection title="المعلومات المهنية">
        <SectionHeader title="المعلومات المهنية" icon="medical-outline" />
        {/* Keep the current specialty Controller and SpecialtyPicker block here. */}
        <SpecialtyPicker
          specialties={specialties}
          selectedId={field.value as Id<'specialties'>}
          onSelect={field.onChange}
          error={errors.specialtyId?.message}
        />
        {/* Keep the current languages Controller and LanguageChips block here. */}
        <LanguageChips
          selectedLanguages={field.value}
          onToggle={handleLanguageToggle}
          error={errors.languages?.message}
        />
        {/* Keep the current years-of-experience Controller and FormField block here. */}
        <FormField
          label="سنوات الخبرة"
          value={field.value?.toString() ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors.yearsOfExperience?.message}
          keyboardType="numeric"
        />
        {/* Keep the current order-registration-number Controller and FormField block here. */}
        <FormField
          label="رقم التسجيل في النقابة"
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors.orderRegistrationNumber?.message}
        />
      </DoctorSection>

      <DoctorSection title="العيادات والأسعار">
        <SectionHeader title="العيادات والأسعار" icon="business-outline" />
        {/* Keep the current consultation-fee Controller and FormField block here. */}
        <FormField
          label="سعر الكشف"
          value={field.value?.toString() ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors.consultationFee?.message}
          keyboardType="numeric"
        />
        {/* Keep the current follow-up-fee Controller and FormField block here. */}
        <FormField
          label="سعر المتابعة"
          value={field.value?.toString() ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors.followUpFee?.message}
          keyboardType="numeric"
        />
        <ClinicsManager
          clinics={profile.clinics}
          wilayas={wilayas}
          communes={communes}
          clinicForm={clinicForm}
          editingClinic={editingClinic}
          onFormChange={handleClinicFormChange}
          onSave={handleSaveClinic}
          onEdit={handleEditClinic}
          onDelete={handleDeleteClinic}
          onCancelEdit={handleCancelClinicEdit}
        />
      </DoctorSection>
```

The comments above are movement markers for existing blocks, not new code to leave in the final screen. Do not remove validation messages or clinic mutation handlers.

- [ ] **Step 8: Add completion styles**

Add:

```ts
  completionPanel: {
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  completionTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  completionValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 26,
    color: theme.colors.official,
  },
  completionLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  completionTrack: {
    height: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
```

- [ ] **Step 9: Run profile tests**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "profile"
```

Expected: PASS.

- [ ] **Step 10: Commit profile**

Run:

```bash
git add 'app/(doctor)/profile.tsx' tests/app-routes/doctor/doctorScreens.test.ts
git commit -m "feat: redesign doctor profile completion view" -- 'app/(doctor)/profile.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

## Task 7: Doctor Settings Operational Preferences

**Files:**
- Modify: `app/(doctor)/settings.tsx`
- Modify: `tests/app-routes/doctor/doctorScreens.test.ts`

- [ ] **Step 1: Read current settings diff**

Run:

```bash
git diff -- 'app/(doctor)/settings.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

Expected: preserve Zustand persistence, privacy modal, logout modal, and existing setting behavior.

- [ ] **Step 2: Write failing settings redesign assertions**

Append to `tests/app-routes/doctor/doctorScreens.test.ts`:

```ts
  test("settings tab is grouped as operational preferences", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );

    expect(source).toContain("@/components/doctor-ui");
    expect(source).toContain("DoctorHeader");
    expect(source).toContain("DoctorSection");
    expect(source).toContain("تفضيلات التشغيل");
    expect(source).toContain("التنبيهات اليومية");
    expect(source).toContain("الحساب والجلسة");
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "settings tab is grouped"
```

Expected: FAIL until settings imports and grouping are updated.

- [ ] **Step 4: Import doctor primitives**

Add:

```ts
import { DoctorHeader, DoctorSection } from '@/components/doctor-ui';
```

- [ ] **Step 5: Add settings header**

At the top of the main render:

```tsx
      <DoctorHeader
        title="تفضيلات التشغيل"
        subtitle="إعدادات هادئة للمواعيد، التنبيهات، اللغة، والجلسة."
        icon="settings-outline"
      />
```

- [ ] **Step 6: Group settings rows**

Wrap notification toggles:

```tsx
      <DoctorSection
        title="التنبيهات اليومية"
        subtitle="تحكم في إشعارات الحجز، الإلغاء، والملخص اليومي."
      >
        <View style={styles.settingsGroup}>
          <ToggleRow
            label="تنبيهات الحجز الجديد"
            value={newBookingAlerts}
            onValueChange={setNewBookingAlerts}
          />
          <ToggleRow
            label="تنبيهات الإلغاء"
            value={cancellationAlerts}
            onValueChange={setCancellationAlerts}
          />
          <ToggleRow
            label="ملخص يومي"
            value={dailySummary}
            onValueChange={setDailySummary}
          />
        </View>
      </DoctorSection>
```

Wrap account/session rows:

```tsx
      <DoctorSection title="الحساب والجلسة">
        <View style={styles.settingsGroup}>
          <OptionRow label="سياسة الخصوصية" value="عرض" onPress={() => setPrivacyModalVisible(true)} />
          <DestructiveRow
            label="تسجيل الخروج"
            icon="log-out-outline"
            onPress={() => setLogoutModalVisible(true)}
          />
        </View>
      </DoctorSection>
```

Keep the existing hours picker and any language rows in the same screen.

- [ ] **Step 7: Add group style**

Add:

```ts
  settingsGroup: {
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
```

- [ ] **Step 8: Run settings tests**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts -t "settings"
```

Expected: PASS.

- [ ] **Step 9: Commit settings**

Run:

```bash
git add 'app/(doctor)/settings.tsx' tests/app-routes/doctor/doctorScreens.test.ts
git commit -m "feat: redesign doctor settings preferences" -- 'app/(doctor)/settings.tsx' tests/app-routes/doctor/doctorScreens.test.ts
```

## Task 8: Full Verification And Doctor-Side Review

**Files:**
- Verify: all doctor tab files
- Do not modify patient files

- [ ] **Step 1: Run route/source tests**

Run:

```bash
npx vitest run tests/app-routes/doctor/doctorScreens.test.ts src/lib/designSystem.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Start Expo web for visual smoke**

Run:

```bash
CI=true WATCHPACK_POLLING=true CHOKIDAR_USEPOLLING=1 npm run web
```

Expected: Expo web starts and prints a local URL, commonly `http://localhost:8081`.

- [ ] **Step 5: Smoke doctor routes only**

Open the Expo URL and verify these routes/screens without editing patient tabs:

```text
/(doctor)/dashboard
/(doctor)/appointments
/(doctor)/schedule
/(doctor)/profile
/(doctor)/settings
```

Expected: each doctor tab renders without redbox, obvious text overlap, or broken tab navigation. Capture screenshots if the browser tooling is available.

- [ ] **Step 6: Confirm no patient redesign slipped in**

Run:

```bash
git diff -- 'app/(patient)' tests/app-routes/patient app.json
```

Expected: no new patient-tab redesign edits from this phase. If there are patient diffs, inspect them and keep only changes required for compile safety.

- [ ] **Step 7: Commit final test-only fixes if needed**

If verification required small doctor-only fixes, commit them path-limited:

```bash
git add 'app/(doctor)' src/components/doctor-ui.tsx tests/app-routes/doctor/doctorScreens.test.ts src/lib/designSystem.test.ts
git commit -m "fix: polish doctor tabs redesign verification" -- 'app/(doctor)' src/components/doctor-ui.tsx tests/app-routes/doctor/doctorScreens.test.ts src/lib/designSystem.test.ts
```

- [ ] **Step 8: Stop before patient tabs**

Prepare a short review message for the user:

```text
Doctor tabs are ready to review. I verified dashboard, appointments, schedule, profile, and settings. I have not started the patient tabs yet.
```

Do not begin patient-tab redesign until the user approves the doctor tabs.
