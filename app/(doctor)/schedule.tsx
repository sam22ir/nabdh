import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';

import { api } from '@/convex/_generated/api';
import {
  DoctorHeader,
  DoctorSection,
  MetricStrip,
  type MetricItem,
} from '@/components/doctor-ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import type { DayOfWeek } from '@/lib/types';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Constants
// =============================================================================

const TOAST_DURATION = 2500;

const DAY_NAMES_AR: Record<DayOfWeek, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 7; h <= 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
})();

const HOURS_12_LABELS: Record<string, string> = {
  '07:00': '07:00 ص',
  '07:30': '07:30 ص',
  '08:00': '08:00 ص',
  '08:30': '08:30 ص',
  '09:00': '09:00 ص',
  '09:30': '09:30 ص',
  '10:00': '10:00 ص',
  '10:30': '10:30 ص',
  '11:00': '11:00 ص',
  '11:30': '11:30 ص',
  '12:00': '12:00 م',
  '12:30': '12:30 م',
  '13:00': '01:00 م',
  '13:30': '01:30 م',
  '14:00': '02:00 م',
  '14:30': '02:30 م',
  '15:00': '03:00 م',
  '15:30': '03:30 م',
  '16:00': '04:00 م',
  '16:30': '04:30 م',
  '17:00': '05:00 م',
  '17:30': '05:30 م',
  '18:00': '06:00 م',
  '18:30': '06:30 م',
  '19:00': '07:00 م',
  '19:30': '07:30 م',
  '20:00': '08:00 م',
};

// =============================================================================
// Types
// =============================================================================

interface ClinicView {
  id: Id<'clinics'>;
  doctorId: Id<'doctors'>;
  name: string;
  wilayaId: Id<'wilayas'>;
  communeId: Id<'communes'>;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  isActive: boolean;
}

/** A schedule entry for one clinic on one day, enriched with an `enabled` flag. */
interface EditableSchedule {
  id: string;
  clinicId: Id<'clinics'>;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  appointmentDurationMinutes: number;
  maxPatientsPerDay: number;
  enabled: boolean;
}

/** In-memory schedule state keyed by clinicId -> dayOfWeek -> EditableSchedule */
type ScheduleMap = Record<string, Record<DayOfWeek, EditableSchedule>>;

interface ScheduleExceptionView {
  id: Id<'scheduleExceptions'>;
  clinicId: Id<'clinics'>;
  exceptionDate: string;
  isClosed: boolean;
  customStartTime: string | null;
  customEndTime: string | null;
  reason: string | null;
}

/** Form state for the add-exception modal. */
interface ExceptionForm {
  exceptionDate: string;
  reason: string;
  isClosed: boolean;
  customStartTime: string;
  customEndTime: string;
}

const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';
const DEFAULT_DURATION = 20;
const DEFAULT_MAX_PATIENTS = 20;

const INITIAL_EXCEPTION_FORM: ExceptionForm = {
  exceptionDate: '',
  reason: '',
  isClosed: true,
  customStartTime: '',
  customEndTime: '',
};

// =============================================================================
// Helpers
// =============================================================================

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  // Expects YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getStatusLabel(exception: ScheduleExceptionView): string {
  if (exception.isClosed) return 'مغلقة';
  if (exception.customStartTime && exception.customEndTime) {
    return `${exception.customStartTime} - ${exception.customEndTime}`;
  }
  return 'دوام خاص';
}

function getStatusColor(exception: ScheduleExceptionView): string {
  if (exception.isClosed) return theme.colors.danger;
  return theme.colors.warning;
}

function getStatusBackground(exception: ScheduleExceptionView): string {
  if (exception.isClosed) return '#FDEDEC';
  return '#FEF3CD';
}

function toDayOfWeek(value: number): DayOfWeek {
  return (value >= 0 && value <= 6 ? value : 0) as DayOfWeek;
}

function createDefaultSchedule(clinicId: Id<'clinics'>, day: DayOfWeek): EditableSchedule {
  return {
    id: `new-${clinicId}-${day}`,
    clinicId,
    dayOfWeek: day,
    startTime: DEFAULT_START,
    endTime: DEFAULT_END,
    appointmentDurationMinutes: DEFAULT_DURATION,
    maxPatientsPerDay: DEFAULT_MAX_PATIENTS,
    enabled: day >= 1 && day <= 5,
  };
}

function buildScheduleMap(
  clinics: ClinicView[],
  schedules: Array<{
    _id: Id<'schedules'>;
    clinicId: Id<'clinics'>;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    appointmentDurationMinutes: number;
    maxPatientsPerDay: number;
    isActive: boolean;
  }>,
): ScheduleMap {
  const map: ScheduleMap = {};
  for (const clinic of clinics) {
    map[clinic.id] = {} as Record<DayOfWeek, EditableSchedule>;
    for (const day of DAYS) {
      map[clinic.id][day] = createDefaultSchedule(clinic.id, day);
    }
  }

  for (const schedule of schedules) {
    const day = toDayOfWeek(schedule.dayOfWeek);
    if (!map[schedule.clinicId]) continue;
    map[schedule.clinicId][day] = {
      id: schedule._id,
      clinicId: schedule.clinicId,
      dayOfWeek: day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      appointmentDurationMinutes: schedule.appointmentDurationMinutes,
      maxPatientsPerDay: schedule.maxPatientsPerDay,
      enabled: schedule.isActive,
    };
  }

  return map;
}

function toClinicView(clinic: {
  _id: Id<'clinics'>;
  doctorId: Id<'doctors'>;
  name: string;
  wilayaId: Id<'wilayas'>;
  communeId: Id<'communes'>;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  isActive: boolean;
}): ClinicView {
  return {
    id: clinic._id,
    doctorId: clinic.doctorId,
    name: clinic.name,
    wilayaId: clinic.wilayaId,
    communeId: clinic.communeId,
    address: clinic.address,
    latitude: clinic.latitude,
    longitude: clinic.longitude,
    phone: clinic.phone,
    isActive: clinic.isActive,
  };
}

function toExceptionView(exception: {
  _id: Id<'scheduleExceptions'>;
  clinicId: Id<'clinics'>;
  exceptionDate: string;
  isClosed: boolean;
  customStartTime?: string;
  customEndTime?: string;
  reason: string;
}): ScheduleExceptionView {
  return {
    id: exception._id,
    clinicId: exception.clinicId,
    exceptionDate: exception.exceptionDate,
    isClosed: exception.isClosed,
    customStartTime: exception.customStartTime ?? null,
    customEndTime: exception.customEndTime ?? null,
    reason: exception.reason || null,
  };
}

function countActiveScheduleDays(scheduleMap: ScheduleMap): number {
  return Object.values(scheduleMap).reduce(
    (total, clinicSchedule) =>
      total +
      Object.values(clinicSchedule).filter((schedule) => schedule.enabled)
        .length,
    0,
  );
}

// =============================================================================
// Sub-components
// =============================================================================

// ── Toast ───────────────────────────────────────────────────────────────────

interface ToastProps {
  visible: boolean;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const Toast: React.FC<ToastProps> = ({ visible, message, icon }) => {
  if (!visible) return null;

  return (
    <View style={styles.toastContainer}>
      <View style={styles.toastContent}>
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={theme.colors.white}
            style={styles.toastIcon}
          />
        ) : null}
        <Text style={styles.toastMessage}>{message}</Text>
      </View>
    </View>
  );
};

// ── Bottom Sheet Modal Wrapper ──────────────────────────────────────────────

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  title,
  children,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandleRow}>
          <View style={styles.modalHandleBar} />
        </View>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.modalCloseButton,
              pressed && styles.modalCloseButtonPressed,
            ]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="إغلاق"
          >
            <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  </Modal>
);

// ── Time Picker Item ────────────────────────────────────────────────────────

interface TimeSlotItemProps {
  time: string;
  isSelected: boolean;
  onSelect: (time: string) => void;
}

const TimeSlotItem: React.FC<TimeSlotItemProps> = React.memo(
  ({ time, isSelected, onSelect }) => (
    <Pressable
      style={({ pressed }) => [
        styles.timeSlotItem,
        isSelected && styles.timeSlotItemSelected,
        pressed && styles.timeSlotItemPressed,
      ]}
      onPress={() => onSelect(time)}
      accessibilityRole="button"
      accessibilityLabel={HOURS_12_LABELS[time] ?? time}
    >
      <Text
        style={[
          styles.timeSlotText,
          isSelected && styles.timeSlotTextSelected,
        ]}
      >
        {HOURS_12_LABELS[time] ?? time}
      </Text>
      {isSelected ? (
        <Ionicons
          name="checkmark"
          size={18}
          color={theme.colors.primary}
          style={styles.timeSlotCheck}
        />
      ) : null}
    </Pressable>
  ),
);

// ── Time Picker Modal ───────────────────────────────────────────────────────

interface TimePickerModalProps {
  visible: boolean;
  selectedTime: string;
  onSelect: (time: string) => void;
  onClose: () => void;
  title?: string;
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  selectedTime,
  onSelect,
  onClose,
  title = 'اختر الوقت',
}) => {
  const renderTimeSlot = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <TimeSlotItem
        time={item}
        isSelected={item === selectedTime}
        onSelect={onSelect}
      />
    ),
    [selectedTime, onSelect],
  );

  const keyExtractor = useCallback((item: string) => item, []);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={title}>
      <FlatList
        data={TIME_SLOTS}
        renderItem={renderTimeSlot}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.timePickerList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </BottomSheetModal>
  );
};

// ── Duration Picker Modal ───────────────────────────────────────────────────

interface DurationPickerModalProps {
  visible: boolean;
  selectedDuration: number;
  onSelect: (duration: number) => void;
  onClose: () => void;
}

const DurationPickerModal: React.FC<DurationPickerModalProps> = ({
  visible,
  selectedDuration,
  onSelect,
  onClose,
}) => {
  const renderDuration = useCallback(
    ({ item }: ListRenderItemInfo<(typeof DURATION_OPTIONS)[number]>) => {
      const isSelected = item === selectedDuration;
      return (
        <Pressable
          style={({ pressed }) => [
            styles.pickerOption,
            isSelected && styles.pickerOptionSelected,
            pressed && styles.pickerOptionPressed,
          ]}
          onPress={() => onSelect(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item} دقيقة`}
        >
          <Text
            style={[
              styles.pickerOptionText,
              isSelected && styles.pickerOptionTextSelected,
            ]}
          >
            {item} دقيقة
          </Text>
          {isSelected ? (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.colors.primary}
              style={styles.pickerOptionCheck}
            />
          ) : null}
        </Pressable>
      );
    },
    [selectedDuration, onSelect],
  );

  const keyExtractor = useCallback(
    (item: number) => String(item),
    [],
  );

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="مدة الموعد"
    >
      <FlatList
        data={[...DURATION_OPTIONS]}
        renderItem={renderDuration}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.pickerListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </BottomSheetModal>
  );
};

// ── Day Row ─────────────────────────────────────────────────────────────────

interface DayRowProps {
  day: DayOfWeek;
  schedule: EditableSchedule;
  clinicId: Id<'clinics'>;
  onToggle: (clinicId: Id<'clinics'>, day: DayOfWeek) => void;
  onStartTimePress: (clinicId: Id<'clinics'>, day: DayOfWeek) => void;
  onEndTimePress: (clinicId: Id<'clinics'>, day: DayOfWeek) => void;
  onDurationPress: (clinicId: Id<'clinics'>, day: DayOfWeek) => void;
  onMaxPatientsChange: (clinicId: Id<'clinics'>, day: DayOfWeek, value: string) => void;
}

const DayRow: React.FC<DayRowProps> = ({
  day,
  schedule,
  clinicId,
  onToggle,
  onStartTimePress,
  onEndTimePress,
  onDurationPress,
  onMaxPatientsChange,
}) => {
  const isEnabled = schedule.enabled;

  return (
    <View style={[styles.dayRow, !isEnabled && styles.dayRowDisabled]}>
      {/* Day name + toggle */}
      <View style={styles.dayRowHeader}>
        <View style={styles.dayNameContainer}>
          <Switch
            value={isEnabled}
            onValueChange={() => onToggle(clinicId, day)}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.secondary,
            }}
            thumbColor={isEnabled ? theme.colors.primary : '#F4F3F4'}
            accessibilityLabel={`${DAY_NAMES_AR[day]} ${isEnabled ? 'مفعل' : 'معطل'}`}
          />
          <Text
            style={[
              styles.dayNameText,
              !isEnabled && styles.dayNameTextDisabled,
            ]}
          >
            {DAY_NAMES_AR[day]}
          </Text>
        </View>
      </View>

      {/* Time + Duration + Max Patients */}
      {isEnabled && (
        <View style={styles.dayRowBody}>
          {/* Time pickers row */}
          <View style={styles.timeRow}>
            <Pressable
              style={({ pressed }) => [
                styles.timeChip,
                pressed && styles.timeChipPressed,
              ]}
              onPress={() => onStartTimePress(clinicId, day)}
              accessibilityRole="button"
              accessibilityLabel={`بداية: ${schedule.startTime}`}
            >
              <Ionicons name="sunny-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.timeChipText}>{schedule.startTime}</Text>
            </Pressable>

            <Text style={styles.timeSeparator}>-</Text>

            <Pressable
              style={({ pressed }) => [
                styles.timeChip,
                pressed && styles.timeChipPressed,
              ]}
              onPress={() => onEndTimePress(clinicId, day)}
              accessibilityRole="button"
              accessibilityLabel={`نهاية: ${schedule.endTime}`}
            >
              <Ionicons name="moon-outline" size={14} color={theme.colors.warning} />
              <Text style={styles.timeChipText}>{schedule.endTime}</Text>
            </Pressable>
          </View>

          {/* Duration + Max patients */}
          <View style={styles.dayRowMeta}>
            <Pressable
              style={({ pressed }) => [
                styles.metaChip,
                pressed && styles.metaChipPressed,
              ]}
              onPress={() => onDurationPress(clinicId, day)}
              accessibilityRole="button"
              accessibilityLabel={`مدة الموعد: ${schedule.appointmentDurationMinutes} دقيقة`}
            >
              <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.metaChipText}>
                {schedule.appointmentDurationMinutes} د
              </Text>
            </Pressable>

            <View style={styles.maxPatientsInputContainer}>
              <Ionicons name="people-outline" size={14} color={theme.colors.textSecondary} />
              <TextInput
                style={styles.maxPatientsInput}
                value={String(schedule.maxPatientsPerDay)}
                onChangeText={(text) => onMaxPatientsChange(clinicId, day, text)}
                keyboardType="number-pad"
                placeholder="20"
                placeholderTextColor={theme.colors.textSecondary}
                accessibilityLabel="الحد الأقصى للمرضى"
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// ── Clinic Card ─────────────────────────────────────────────────────────────

interface ClinicCardProps {
  clinic: ClinicView;
  scheduleMap: ScheduleMap;
  expandedClinics: Record<string, boolean>;
  onToggleExpand: (clinicId: Id<'clinics'>) => void;
  onDayToggle: (clinicId: Id<'clinics'>, day: DayOfWeek) => void;
  onStartTimePress: (clinicId: Id<'clinics'>, day: DayOfWeek) => void;
  onEndTimePress: (clinicId: Id<'clinics'>, day: DayOfWeek) => void;
  onDurationPress: (clinicId: Id<'clinics'>, day: DayOfWeek) => void;
  onMaxPatientsChange: (clinicId: Id<'clinics'>, day: DayOfWeek, value: string) => void;
}

const ClinicCard: React.FC<ClinicCardProps> = ({
  clinic,
  scheduleMap,
  expandedClinics,
  onToggleExpand,
  onDayToggle,
  onStartTimePress,
  onEndTimePress,
  onDurationPress,
  onMaxPatientsChange,
}) => {
  const isExpanded = expandedClinics[clinic.id] ?? true;
  const clinicSchedule = scheduleMap[clinic.id];
  const days = DAYS;

  return (
    <View style={styles.clinicCard}>
      {/* Clinic header — pressable to collapse/expand */}
      <Pressable
        style={({ pressed }) => [
          styles.clinicHeader,
          pressed && styles.clinicHeaderPressed,
        ]}
        onPress={() => onToggleExpand(clinic.id)}
        accessibilityRole="button"
        accessibilityLabel={`${clinic.name} - اضغط للطي أو التوسيع`}
      >
        <View style={styles.clinicHeaderLeft}>
          <View style={styles.clinicIconContainer}>
            <Ionicons name="business" size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.clinicHeaderInfo}>
            <Text style={styles.clinicName} numberOfLines={1}>
              {clinic.name}
            </Text>
            <Text style={styles.clinicAddress} numberOfLines={1}>
              {clinic.address}
            </Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textSecondary}
        />
      </Pressable>

      {/* Schedule days */}
      {isExpanded && (
        <View style={styles.clinicScheduleBody}>
          {days.map((day) => (
            <DayRow
              key={day}
              day={day}
              clinicId={clinic.id}
              schedule={clinicSchedule[day]}
              onToggle={onDayToggle}
              onStartTimePress={onStartTimePress}
              onEndTimePress={onEndTimePress}
              onDurationPress={onDurationPress}
              onMaxPatientsChange={onMaxPatientsChange}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ── Exception Item ──────────────────────────────────────────────────────────

interface ExceptionItemProps {
  exception: ScheduleExceptionView;
  clinicName: string;
  onDelete?: (exceptionId: Id<'scheduleExceptions'>) => void;
}

const ExceptionItem: React.FC<ExceptionItemProps> = ({
  exception,
  clinicName,
  onDelete,
}) => {
  const statusLabel = getStatusLabel(exception);
  const statusColor = getStatusColor(exception);
  const statusBg = getStatusBackground(exception);

  return (
    <View style={styles.exceptionItem}>
      <View style={styles.exceptionItemLeft}>
        {/* Date */}
        <View style={styles.exceptionDateRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.exceptionDate}>
            {formatDateDisplay(exception.exceptionDate)}
          </Text>
        </View>

        {/* Reason */}
        {exception.reason ? (
          <Text style={styles.exceptionReason} numberOfLines={2}>
            {exception.reason}
          </Text>
        ) : null}

        {/* Clinic name (small) */}
        <Text style={styles.exceptionClinicName}>{clinicName}</Text>
      </View>

      <View style={styles.exceptionItemRight}>
        {/* Status badge */}
        <View style={[styles.exceptionStatusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.exceptionStatusText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>

        {/* Delete button */}
        {onDelete ? (
          <Pressable
            style={({ pressed }) => [
              styles.exceptionDeleteButton,
              pressed && styles.exceptionDeleteButtonPressed,
            ]}
            onPress={() => onDelete(exception.id)}
            accessibilityRole="button"
            accessibilityLabel="حذف الاستثناء"
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

// ── Add Exception Modal ─────────────────────────────────────────────────────

interface AddExceptionModalProps {
  visible: boolean;
  selectedClinicId: Id<'clinics'> | null;
  form: ExceptionForm;
  clinics: ClinicView[];
  onFormChange: (field: keyof ExceptionForm, value: string | boolean) => void;
  onClinicChange: (clinicId: Id<'clinics'>) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

const AddExceptionModal: React.FC<AddExceptionModalProps> = ({
  visible,
  selectedClinicId,
  form,
  clinics,
  onFormChange,
  onClinicChange,
  onSave,
  onClose,
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);

  const selectedClinicName = useMemo(
    () => clinics.find((c) => c.id === selectedClinicId)?.name ?? 'اختر العيادة',
    [clinics, selectedClinicId],
  );

  const canSave = form.exceptionDate.trim().length > 0 && selectedClinicId !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View style={styles.addExceptionSheet}>
          <View style={styles.modalHandleRow}>
            <View style={styles.modalHandleBar} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.addExceptionContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.addExceptionHeader}>
              <Text style={styles.addExceptionTitle}>إضافة استثناء</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  pressed && styles.modalCloseButtonPressed,
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            {/* Clinic picker */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>العيادة</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.dropdownField,
                  pressed && styles.dropdownFieldPressed,
                ]}
                onPress={() => setPickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="اختر العيادة"
              >
                <Text
                  style={[
                    styles.dropdownFieldText,
                    !selectedClinicId && styles.dropdownFieldPlaceholder,
                  ]}
                >
                  {selectedClinicName}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            {/* Date */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>التاريخ</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.exceptionDate}
                onChangeText={(text) => onFormChange('exceptionDate', text)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.textSecondary}
                textAlign="right"
                accessibilityLabel="التاريخ"
              />
            </View>

            {/* Reason */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>السبب</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMultiline]}
                value={form.reason}
                onChangeText={(text) => onFormChange('reason', text)}
                placeholder="سبب الاستثناء..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                textAlignVertical="top"
                textAlign="right"
                accessibilityLabel="السبب"
              />
            </View>

            {/* Is Closed toggle */}
            <View style={styles.fieldContainer}>
              <View style={styles.toggleRow}>
                <Text style={styles.fieldLabel}>العيادة مغلقة</Text>
                <Switch
                  value={form.isClosed}
                  onValueChange={(val) => onFormChange('isClosed', val)}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.secondary,
                  }}
                  thumbColor={form.isClosed ? theme.colors.danger : '#F4F3F4'}
                  accessibilityLabel="العيادة مغلقة"
                />
              </View>
            </View>

            {/* Custom time (only if not closed) */}
            {!form.isClosed && (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>وقت البدء (اختياري)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.customStartTime}
                    onChangeText={(text) => onFormChange('customStartTime', text)}
                    placeholder="HH:mm"
                    placeholderTextColor={theme.colors.textSecondary}
                    textAlign="right"
                    accessibilityLabel="وقت البدء"
                  />
                </View>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>وقت الانتهاء (اختياري)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.customEndTime}
                    onChangeText={(text) => onFormChange('customEndTime', text)}
                    placeholder="HH:mm"
                    placeholderTextColor={theme.colors.textSecondary}
                    textAlign="right"
                    accessibilityLabel="وقت الانتهاء"
                  />
                </View>
              </>
            )}

            {/* Save button */}
            <Pressable
              style={({ pressed }) => [
                styles.addExceptionSaveButton,
                !canSave && styles.addExceptionSaveButtonDisabled,
                pressed && styles.addExceptionSaveButtonPressed,
              ]}
              onPress={onSave}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="حفظ الاستثناء"
            >
              <Ionicons name="save-outline" size={18} color={theme.colors.white} />
              <Text style={styles.addExceptionSaveButtonText}>حفظ</Text>
            </Pressable>
          </ScrollView>
        </View>
        <ClinicPickerModal
          visible={pickerVisible}
          clinics={clinics}
          selectedId={selectedClinicId}
          onSelect={onClinicChange}
          onClose={() => setPickerVisible(false)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Clinic Picker Modal (for exception form) ─────────────────────────────────

interface ClinicPickerModalProps {
  visible: boolean;
  clinics: ClinicView[];
  selectedId: Id<'clinics'> | null;
  onSelect: (clinicId: Id<'clinics'>) => void;
  onClose: () => void;
}

const ClinicPickerModal: React.FC<ClinicPickerModalProps> = ({
  visible,
  clinics,
  selectedId,
  onSelect,
  onClose,
}) => {
  const renderClinic = useCallback(
    ({ item }: ListRenderItemInfo<ClinicView>) => {
      const isSelected = item.id === selectedId;
      return (
        <Pressable
          style={({ pressed }) => [
            styles.pickerOption,
            isSelected && styles.pickerOptionSelected,
            pressed && styles.pickerOptionPressed,
          ]}
          onPress={() => {
            onSelect(item.id);
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel={item.name}
        >
          <View style={styles.pickerOptionContent}>
            <Text
              style={[
                styles.pickerOptionText,
                isSelected && styles.pickerOptionTextSelected,
              ]}
            >
              {item.name}
            </Text>
            <Text style={styles.pickerOptionSub}>{item.address}</Text>
          </View>
          {isSelected ? (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.colors.primary}
              style={styles.pickerOptionCheck}
            />
          ) : null}
        </Pressable>
      );
    },
    [selectedId, onSelect, onClose],
  );

  const keyExtractor = useCallback((item: ClinicView) => item.id, []);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="اختر العيادة"
    >
      <FlatList
        data={clinics}
        renderItem={renderClinic}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.pickerListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </BottomSheetModal>
  );
};

// =============================================================================
// Main Screen
// =============================================================================

export default function DoctorScheduleScreen() {
  const router = useRouter();
  const clinicDocs = useQuery(api.clinics.getMyClinics, {});
  const scheduleDocs = useQuery(api.schedules.getMySchedules, {});
  const exceptionDocs = useQuery(api.schedules.getMyExceptions, {});
  const upsertDay = useMutation(api.schedules.upsertDay);
  const addException = useMutation(api.schedules.addException);
  const removeException = useMutation(api.schedules.removeException);

  // ── Toast state ─────────────────────────────────────────────────────────────
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('تم الحفظ');
  const [expandedClinics, setExpandedClinics] = useState<Record<string, boolean>>({});

  // ── Time picker state ───────────────────────────────────────────────────────
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{
    clinicId: Id<'clinics'>;
    day: DayOfWeek;
    field: 'startTime' | 'endTime';
  } | null>(null);

  // ── Duration picker state ───────────────────────────────────────────────────
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);
  const [durationPickerTarget, setDurationPickerTarget] = useState<{
    clinicId: Id<'clinics'>;
    day: DayOfWeek;
  } | null>(null);

  // ── Exception modal state ───────────────────────────────────────────────────
  const [exceptionModalVisible, setExceptionModalVisible] = useState(false);
  const [exceptionForm, setExceptionForm] = useState<ExceptionForm>({
    ...INITIAL_EXCEPTION_FORM,
  });
  const [selectedExceptionClinicId, setSelectedExceptionClinicId] = useState<Id<'clinics'> | null>(null);

  // ── Compute derived data ────────────────────────────────────────────────────
  const clinics = useMemo(
    () => (clinicDocs ?? []).filter((clinic) => clinic.isActive).map(toClinicView),
    [clinicDocs],
  );

  const scheduleMap = useMemo(
    () => buildScheduleMap(clinics, scheduleDocs ?? []),
    [clinics, scheduleDocs],
  );

  const exceptions = useMemo(
    () => (exceptionDocs ?? []).map(toExceptionView),
    [exceptionDocs],
  );

  const clinicNameById = useMemo(
    () =>
      clinics.reduce(
        (acc, c) => {
          acc[c.id] = c.name;
          return acc;
        },
        {} as Record<string, string>,
      ),
    [clinics],
  );

  const metricItems = useMemo((): MetricItem[] => [
    {
      label: 'عيادات نشطة',
      value: clinics.length,
      icon: 'business-outline',
      tone: 'info',
    },
    {
      label: 'أيام مفتوحة',
      value: countActiveScheduleDays(scheduleMap),
      icon: 'calendar-outline',
      tone: 'success',
    },
    {
      label: 'استثناءات',
      value: exceptions.length,
      icon: 'alert-circle-outline',
      tone: exceptions.length > 0 ? 'warning' : 'neutral',
    },
  ], [clinics.length, exceptions.length, scheduleMap]);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), TOAST_DURATION);
  }, []);

  const persistSchedule = useCallback(
    async (schedule: EditableSchedule) => {
      await upsertDay({
        clinicId: schedule.clinicId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        appointmentDurationMinutes: schedule.appointmentDurationMinutes,
        maxPatientsPerDay: schedule.maxPatientsPerDay,
        isActive: schedule.enabled,
      });
      showToast('تم حفظ جدول اليوم');
    },
    [showToast, upsertDay],
  );

  // ── Clinic expand/collapse ──────────────────────────────────────────────────
  const handleToggleExpand = useCallback((clinicId: Id<'clinics'>) => {
    setExpandedClinics((prev) => ({ ...prev, [clinicId]: !prev[clinicId] }));
  }, []);

  // ── Day toggle ──────────────────────────────────────────────────────────────
  const handleDayToggle = useCallback(
    (clinicId: Id<'clinics'>, day: DayOfWeek) => {
      const current = scheduleMap[clinicId]?.[day];
      if (!current) return;
      void persistSchedule({ ...current, enabled: !current.enabled });
    },
    [persistSchedule, scheduleMap],
  );

  // ── Max patients change ─────────────────────────────────────────────────────
  const handleMaxPatientsChange = useCallback(
    (clinicId: Id<'clinics'>, day: DayOfWeek, value: string) => {
      const parsed = parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < 1) return;
      const current = scheduleMap[clinicId]?.[day];
      if (!current) return;
      void persistSchedule({ ...current, maxPatientsPerDay: parsed });
    },
    [persistSchedule, scheduleMap],
  );

  // ── Time picker openers ─────────────────────────────────────────────────────
  const handleStartTimePress = useCallback(
    (clinicId: Id<'clinics'>, day: DayOfWeek) => {
      setTimePickerTarget({ clinicId, day, field: 'startTime' });
      setTimePickerVisible(true);
    },
    [],
  );

  const handleEndTimePress = useCallback(
    (clinicId: Id<'clinics'>, day: DayOfWeek) => {
      setTimePickerTarget({ clinicId, day, field: 'endTime' });
      setTimePickerVisible(true);
    },
    [],
  );

  const handleTimeSelect = useCallback(
    (time: string) => {
      if (!timePickerTarget) return;
      const { clinicId, day, field } = timePickerTarget;
      const current = scheduleMap[clinicId]?.[day];
      if (current) {
        void persistSchedule({ ...current, [field]: time });
      }
      setTimePickerVisible(false);
      setTimePickerTarget(null);
    },
    [persistSchedule, scheduleMap, timePickerTarget],
  );

  const handleTimePickerClose = useCallback(() => {
    setTimePickerVisible(false);
    setTimePickerTarget(null);
  }, []);

  // ── Duration picker ─────────────────────────────────────────────────────────
  const handleDurationPress = useCallback(
    (clinicId: Id<'clinics'>, day: DayOfWeek) => {
      setDurationPickerTarget({ clinicId, day });
      setDurationPickerVisible(true);
    },
    [],
  );

  const handleDurationSelect = useCallback(
    (duration: number) => {
      if (!durationPickerTarget) return;
      const { clinicId, day } = durationPickerTarget;
      const current = scheduleMap[clinicId]?.[day];
      if (current) {
        void persistSchedule({
          ...current,
          appointmentDurationMinutes: duration,
        });
      }
      setDurationPickerVisible(false);
      setDurationPickerTarget(null);
    },
    [durationPickerTarget, persistSchedule, scheduleMap],
  );

  const handleDurationPickerClose = useCallback(() => {
    setDurationPickerVisible(false);
    setDurationPickerTarget(null);
  }, []);

  // ── Exception handlers ──────────────────────────────────────────────────────
  const handleExceptionFormChange = useCallback(
    (field: keyof ExceptionForm, value: string | boolean) => {
      setExceptionForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleExceptionClinicChange = useCallback((clinicId: Id<'clinics'>) => {
    setSelectedExceptionClinicId(clinicId);
  }, []);

  const handleAddException = useCallback(async () => {
    if (!selectedExceptionClinicId || !exceptionForm.exceptionDate.trim()) return;

    await addException({
      clinicId: selectedExceptionClinicId,
      exceptionDate: exceptionForm.exceptionDate.trim(),
      isClosed: exceptionForm.isClosed,
      customStartTime: exceptionForm.isClosed
        ? undefined
        : exceptionForm.customStartTime.trim() || undefined,
      customEndTime: exceptionForm.isClosed
        ? undefined
        : exceptionForm.customEndTime.trim() || undefined,
      reason: exceptionForm.reason.trim(),
    });

    setExceptionForm({ ...INITIAL_EXCEPTION_FORM });
    setExceptionModalVisible(false);
    showToast('تمت إضافة الاستثناء');
  }, [addException, selectedExceptionClinicId, exceptionForm, showToast]);

  const handleDeleteException = useCallback(
    async (exceptionId: Id<'scheduleExceptions'>) => {
      await removeException({ exceptionId });
      showToast('تم حذف الاستثناء');
    },
    [removeException, showToast],
  );

  // ── Render clinic item ──────────────────────────────────────────────────────
  const renderClinic = useCallback(
    ({ item }: ListRenderItemInfo<ClinicView>) => (
      <ClinicCard
        clinic={item}
        scheduleMap={scheduleMap}
        expandedClinics={expandedClinics}
        onToggleExpand={handleToggleExpand}
        onDayToggle={handleDayToggle}
        onStartTimePress={handleStartTimePress}
        onEndTimePress={handleEndTimePress}
        onDurationPress={handleDurationPress}
        onMaxPatientsChange={handleMaxPatientsChange}
      />
    ),
    [
      scheduleMap,
      expandedClinics,
      handleToggleExpand,
      handleDayToggle,
      handleStartTimePress,
      handleEndTimePress,
      handleDurationPress,
      handleMaxPatientsChange,
    ],
  );

  const clinicKeyExtractor = useCallback((item: ClinicView) => item.id, []);

  // ── Render exception item ───────────────────────────────────────────────────
  const renderException = useCallback(
    ({ item }: ListRenderItemInfo<ScheduleExceptionView>) => (
      <ExceptionItem
        exception={item}
        clinicName={clinicNameById[item.clinicId] ?? ''}
        onDelete={handleDeleteException}
      />
    ),
    [clinicNameById, handleDeleteException],
  );

  const exceptionKeyExtractor = useCallback(
    (item: ScheduleExceptionView) => item.id,
    [],
  );

  // ── Time picker selected time ───────────────────────────────────────────────
  const selectedTimeForPicker = useMemo(() => {
    if (!timePickerTarget) return TIME_SLOTS[0];
    const s = scheduleMap[timePickerTarget.clinicId]?.[timePickerTarget.day];
    return s?.[timePickerTarget.field] ?? TIME_SLOTS[0];
  }, [timePickerTarget, scheduleMap]);

  // ── Duration picker selected duration ───────────────────────────────────────
  const selectedDurationForPicker = useMemo(() => {
    if (!durationPickerTarget) return DURATION_OPTIONS[2];
    return (
      scheduleMap[durationPickerTarget.clinicId]?.[durationPickerTarget.day]
        ?.appointmentDurationMinutes ?? DURATION_OPTIONS[2]
    );
  }, [durationPickerTarget, scheduleMap]);

  const handleOpenExceptionModal = useCallback(() => {
    setSelectedExceptionClinicId((prev) => prev ?? clinics[0]?.id ?? null);
    setExceptionModalVisible(true);
  }, [clinics]);

  const handleAddClinicPress = useCallback(() => {
    router.push('/(doctor)/profile');
  }, [router]);

  if (clinicDocs === undefined || scheduleDocs === undefined || exceptionDocs === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل جدول المواعيد...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <DoctorHeader
            eyebrow="ساعات العيادة"
            title="إدارة السعة الأسبوعية"
            subtitle="اضبط الأيام المفتوحة، ساعات العمل، مدة الموعد، والحد الأقصى للمرضى لكل عيادة."
            icon="time-outline"
          />

          <MetricStrip items={metricItems} />

          <DoctorSection
            title="العيادات"
            subtitle="فعّل أو أغلق أيام العمل لكل عيادة"
          >
            {clinics.length > 0 ? (
              <FlatList
                data={clinics}
                renderItem={renderClinic}
                keyExtractor={clinicKeyExtractor}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyExceptions}>
                <Ionicons name="business-outline" size={40} color={theme.colors.textSecondary} />
                <Text style={styles.emptyExceptionsText}>
                  لا توجد عيادات نشطة
                </Text>
                <Text style={styles.emptyExceptionsSubtext}>
                  أضف عيادة نشطة قبل إعداد جدول المواعيد
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.emptyClinicAction,
                    pressed && styles.emptyClinicActionPressed,
                  ]}
                  onPress={handleAddClinicPress}
                  accessibilityRole="button"
                  accessibilityLabel="إضافة عيادة"
                >
                  <Ionicons name="add-circle-outline" size={18} color={theme.colors.white} />
                  <Text style={styles.emptyClinicActionText}>إضافة عيادة</Text>
                </Pressable>
              </View>
            )}
          </DoctorSection>

          <DoctorSection
            title="الإجازات والاستثناءات"
            subtitle="أغلق يوماً محدداً أو عرّف ساعات خاصة خارج الجدول الأسبوعي"
            action={
              <Pressable
                style={({ pressed }) => [
                  styles.addExceptionButton,
                  clinics.length === 0 && styles.addExceptionButtonDisabled,
                  pressed && clinics.length > 0 && styles.addExceptionButtonPressed,
                ]}
                onPress={handleOpenExceptionModal}
                accessibilityRole="button"
                accessibilityLabel="إضافة استثناء"
                accessibilityState={{ disabled: clinics.length === 0 }}
                disabled={clinics.length === 0}
              >
                <Ionicons
                  name={clinics.length === 0 ? 'business-outline' : 'add'}
                  size={18}
                  color={
                    clinics.length === 0
                      ? theme.colors.textSecondary
                      : theme.colors.white
                  }
                />
                <Text
                  style={[
                    styles.addExceptionButtonText,
                    clinics.length === 0 && styles.addExceptionButtonTextDisabled,
                  ]}
                >
                  {clinics.length === 0 ? 'أضف عيادة أولاً' : 'إضافة'}
                </Text>
              </Pressable>
            }
          >
            {exceptions.length > 0 ? (
              <View style={styles.exceptionsListContainer}>
                <FlatList
                  data={exceptions}
                  renderItem={renderException}
                  keyExtractor={exceptionKeyExtractor}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={styles.exceptionSeparator} />}
                />
              </View>
            ) : (
              <View style={styles.emptyExceptions}>
                <Ionicons name="calendar-outline" size={40} color={theme.colors.textSecondary} />
                <Text style={styles.emptyExceptionsText}>
                  لا توجد إجازات أو استثناءات
                </Text>
                <Text style={styles.emptyExceptionsSubtext}>
                  أضف استثناءً لتعديل جدول يوم معين
                </Text>
              </View>
            )}
          </DoctorSection>

          {/* Bottom spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* ── Toast ──────────────────────────────────────────────── */}
        <Toast visible={toastVisible} message={toastMessage} icon="checkmark-circle" />

        {/* ── Time Picker Modal ──────────────────────────────────── */}
        <TimePickerModal
          visible={timePickerVisible}
          selectedTime={selectedTimeForPicker}
          onSelect={handleTimeSelect}
          onClose={handleTimePickerClose}
          title={
            timePickerTarget?.field === 'startTime'
              ? 'اختر وقت البدء'
              : 'اختر وقت الانتهاء'
          }
        />

        {/* ── Duration Picker Modal ──────────────────────────────── */}
        <DurationPickerModal
          visible={durationPickerVisible}
          selectedDuration={selectedDurationForPicker}
          onSelect={handleDurationSelect}
          onClose={handleDurationPickerClose}
        />

        {/* ── Add Exception Modal ────────────────────────────────── */}
        <AddExceptionModal
          visible={exceptionModalVisible}
          selectedClinicId={selectedExceptionClinicId}
          form={exceptionForm}
          clinics={clinics}
          onFormChange={handleExceptionFormChange}
          onClinicChange={handleExceptionClinicChange}
          onSave={handleAddException}
          onClose={() => {
            setExceptionModalVisible(false);
            setExceptionForm({ ...INITIAL_EXCEPTION_FORM });
          }}
        />

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ─── Layout ──────────────────────────────────────────────────────────────
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    writingDirection: 'rtl',
  },
  scrollContent: {
    paddingBottom: theme.spacing['4xl'],
  },
  bottomSpacer: {
    height: theme.spacing['4xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },

  // ─── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },

  // ─── Section ─────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  sectionHeaderIcon: {
    marginLeft: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },

  // ─── Clinic Card ─────────────────────────────────────────────────────────
  clinicCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
    overflow: 'hidden',
  },
  clinicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  clinicHeaderPressed: {
    opacity: 0.85,
  },
  clinicHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clinicIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  clinicHeaderInfo: {
    flex: 1,
  },
  clinicName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  clinicAddress: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  clinicScheduleBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },

  // ─── Day Row ─────────────────────────────────────────────────────────────
  dayRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  dayRowDisabled: {
    opacity: 0.5,
  },
  dayRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  dayNameContainer: {
    flexDirection: 'row',
    alignItems: 'center-reverse' as any,
    gap: theme.spacing.sm,
  },
  dayNameText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  dayNameTextDisabled: {
    color: theme.colors.textSecondary,
  },
  dayRowBody: {
    gap: theme.spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  timeChipPressed: {
    opacity: 0.75,
  },
  timeChipText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  timeSeparator: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  dayRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  metaChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  metaChipPressed: {
    opacity: 0.75,
  },
  metaChipText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  maxPatientsInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  maxPatientsInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textPrimary,
    padding: 0,
    textAlign: 'right',
  },

  // ─── Exceptions Section ──────────────────────────────────────────────────
  exceptionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: theme.spacing.lg,
  },
  addExceptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  addExceptionButtonPressed: {
    opacity: 0.85,
  },
  addExceptionButtonDisabled: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addExceptionButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.white,
  },
  addExceptionButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  exceptionsListContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  exceptionSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.lg,
  },
  exceptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  exceptionItemLeft: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  exceptionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  exceptionDate: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  exceptionReason: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    lineHeight: 18,
  },
  exceptionClinicName: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  exceptionItemRight: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  exceptionStatusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  exceptionStatusText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
  },
  exceptionDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDEDEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exceptionDeleteButtonPressed: {
    opacity: 0.7,
  },
  emptyExceptions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3xl'],
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  emptyExceptionsText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  emptyExceptionsSubtext: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  emptyClinicAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  emptyClinicActionPressed: {
    opacity: 0.85,
  },
  emptyClinicActionText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.white,
  },

  // ─── Toast ───────────────────────────────────────────────────────────────
  toastContainer: {
    position: 'absolute',
    bottom: theme.spacing['4xl'],
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    alignItems: 'center',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.lg,
  },
  toastIcon: {
    marginLeft: theme.spacing.sm,
  },
  toastMessage: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },

  // ─── Modal (Bottom Sheet) ────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '70%',
    ...theme.shadows.xl,
  },
  modalHandleRow: {
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonPressed: {
    opacity: 0.7,
  },

  // ─── Time Picker ─────────────────────────────────────────────────────────
  timePickerList: {
    paddingBottom: theme.spacing['3xl'],
  },
  timeSlotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  timeSlotItemSelected: {
    backgroundColor: theme.colors.secondary,
  },
  timeSlotItemPressed: {
    opacity: 0.8,
  },
  timeSlotText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  timeSlotTextSelected: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },
  timeSlotCheck: {
    marginRight: theme.spacing.sm,
  },

  // ─── Picker List ─────────────────────────────────────────────────────────
  pickerListContent: {
    paddingBottom: theme.spacing['3xl'],
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: theme.colors.secondary,
  },
  pickerOptionPressed: {
    opacity: 0.8,
  },
  pickerOptionContent: {
    flex: 1,
  },
  pickerOptionText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  pickerOptionTextSelected: {
    color: theme.colors.primary,
  },
  pickerOptionSub: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  pickerOptionCheck: {
    marginRight: theme.spacing.sm,
  },

  // ─── Add Exception Modal ────────────────────────────────────────────────
  addExceptionSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '85%',
    ...theme.shadows.xl,
  },
  addExceptionContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing['4xl'],
  },
  addExceptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  addExceptionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },

  // ─── Fields (reused) ────────────────────────────────────────────────────
  fieldContainer: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: rtlTextAlign(),
  },
  fieldInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  dropdownFieldPressed: {
    opacity: 0.85,
  },
  dropdownFieldText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  dropdownFieldPlaceholder: {
    color: theme.colors.textSecondary,
  },

  // ─── Toggle Row ─────────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ─── Add Exception Save Button ──────────────────────────────────────────
  addExceptionSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addExceptionSaveButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  addExceptionSaveButtonPressed: {
    opacity: 0.85,
  },
  addExceptionSaveButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },
});
