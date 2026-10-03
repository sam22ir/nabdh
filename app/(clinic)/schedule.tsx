import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useMutation, useQuery } from '@/lib/backend';

import { api } from '@/lib/backend/api';
import { BackendError } from '@/lib/backend';
import { DoctorHeader, DoctorSection } from '@/components/doctor-ui';
import { theme } from '@/lib/theme';
import type { Id } from '@/lib/backend/types';
import type { DayOfWeek } from '@/lib/types';

type MembershipCard = {
  _id: Id<'clinicMemberships'>;
  doctorId: Id<'doctors'>;
  doctorName: string;
  doctorPhone?: string;
};

type ClinicProfile = {
  _id: Id<'clinics'>;
  name: string;
};

type ScheduleDoc = {
  _id: Id<'schedules'>;
  clinicId: Id<'clinics'>;
  doctorId?: Id<'doctors'>;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  appointmentDurationMinutes: number;
  isActive: boolean;
};

type ExceptionDoc = {
  _id: Id<'scheduleExceptions'>;
  clinicId: Id<'clinics'>;
  doctorId?: Id<'doctors'>;
  exceptionDate: string;
  endDate?: string;
  reason?: string;
  exceptionType?: 'single_hour' | 'time_range' | 'full_day' | 'multi_day';
  customStartTime?: string;
  customEndTime?: string;
};

type ExceptionMode = 'single_hour' | 'time_range' | 'full_day' | 'multi_day';

type EditableDay = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  appointmentDurationMinutes: number;
  isActive: boolean;
};

const DAYS: Array<{ value: DayOfWeek; label: string }> = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
];

const TIME_OPTIONS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
] as const;

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';
const DEFAULT_DURATION = 20;

function getArabicError(error: unknown, fallback: string) {
  if (error instanceof BackendError && typeof error.message === 'string') {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function formatDateDisplay(dateStr: string) {
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

function getDateWeekday(dateStr: string): DayOfWeek {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getDay() as DayOfWeek;
}

function getExceptionModeLabel(mode: ExceptionMode) {
  switch (mode) {
    case 'single_hour':
      return 'ساعة واحدة';
    case 'time_range':
      return 'من ساعة إلى ساعة';
    case 'full_day':
      return 'يوم كامل';
    case 'multi_day':
      return 'عدة أيام';
  }
}

function formatExceptionSummary(exception: ExceptionDoc) {
  const mode = exception.exceptionType ?? 'full_day';
  if (mode === 'single_hour' && exception.customStartTime && exception.customEndTime) {
    return `${formatDateDisplay(exception.exceptionDate)} · ${exception.customStartTime} - ${exception.customEndTime}`;
  }
  if (mode === 'time_range' && exception.customStartTime && exception.customEndTime) {
    return `${formatDateDisplay(exception.exceptionDate)} · ${exception.customStartTime} - ${exception.customEndTime}`;
  }
  if (mode === 'multi_day' && exception.endDate) {
    return `${formatDateDisplay(exception.exceptionDate)} - ${formatDateDisplay(exception.endDate)}`;
  }
  return formatDateDisplay(exception.exceptionDate);
}

function buildDateOptions(count = 21) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return {
      value: `${year}-${month}-${day}`,
      dayName: date.toLocaleDateString('ar-DZ', { weekday: 'short' }),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString('ar-DZ', { month: 'short' }),
    };
  });
}

function buildDoctorScheduleMap(
  schedules: ScheduleDoc[],
  doctorId: Id<'doctors'> | null,
): Record<DayOfWeek, EditableDay> {
  const initial = {} as Record<DayOfWeek, EditableDay>;
  for (const { value } of DAYS) {
    initial[value] = {
      dayOfWeek: value,
      startTime: DEFAULT_START,
      endTime: DEFAULT_END,
      appointmentDurationMinutes: DEFAULT_DURATION,
      isActive: value >= 1 && value <= 5,
    };
  }

  if (!doctorId) return initial;

  for (const schedule of schedules) {
    if (schedule.doctorId !== doctorId) continue;
    const day = schedule.dayOfWeek as DayOfWeek;
    initial[day] = {
      dayOfWeek: day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      appointmentDurationMinutes: schedule.appointmentDurationMinutes,
      isActive: schedule.isActive,
    };
  }

  return initial;
}

function PickerModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ClinicScheduleScreen() {
  const me = useQuery(api.users.me, {});
  const doctors = useQuery(api.clinicMemberships.listMyClinicDoctors, {}) as
    | MembershipCard[]
    | undefined;

  const clinicProfile =
    me?.role === 'clinic'
      ? (me.profile as ClinicProfile | null | undefined)
      : null;
  const clinicId = clinicProfile?._id ?? null;

  const scheduleDocs = useQuery(
    api.schedules.getByClinic,
    clinicId ? { clinicId } : 'skip',
  ) as ScheduleDoc[] | undefined;

  const exceptionDocs = useQuery(api.schedules.getMyClinicExceptions, {}) as
    | ExceptionDoc[]
    | undefined;

  const upsertDay = useMutation(api.schedules.upsertDay);
  const addClinicException = useMutation(api.schedules.addClinicException);
  const removeException = useMutation(api.schedules.removeException);

  const [selectedDoctorId, setSelectedDoctorId] = useState<Id<'doctors'> | null>(null);
  const [editingField, setEditingField] = useState<{
    day: DayOfWeek;
    field: 'startTime' | 'endTime' | 'appointmentDurationMinutes';
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [exceptionModalVisible, setExceptionModalVisible] = useState(false);
  const [exceptionMode, setExceptionMode] = useState<ExceptionMode>('full_day');
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionEndDate, setExceptionEndDate] = useState('');
  const [exceptionStartTime, setExceptionStartTime] = useState('');
  const [exceptionEndTime, setExceptionEndTime] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');

  const doctorsList = doctors ?? [];

  useEffect(() => {
    if (!doctorsList.length) {
      setSelectedDoctorId(null);
      return;
    }
    if (!selectedDoctorId || !doctorsList.some((item) => item.doctorId === selectedDoctorId)) {
      setSelectedDoctorId(doctorsList[0].doctorId);
    }
  }, [doctorsList, selectedDoctorId]);

  const selectedDoctor = useMemo(
    () => doctorsList.find((doctor) => doctor.doctorId === selectedDoctorId) ?? null,
    [doctorsList, selectedDoctorId],
  );

  const doctorSchedule = useMemo(
    () => buildDoctorScheduleMap(scheduleDocs ?? [], selectedDoctorId),
    [scheduleDocs, selectedDoctorId],
  );

  const doctorExceptions = useMemo(
    () =>
      (exceptionDocs ?? [])
        .filter((item) => item.doctorId === selectedDoctorId)
        .sort((a, b) => a.exceptionDate.localeCompare(b.exceptionDate)),
    [exceptionDocs, selectedDoctorId],
  );

  const dateOptions = useMemo(() => buildDateOptions(), []);
  const exceptionTimeOptions = useMemo(() => {
    if (!exceptionDate) return [];
    const day = doctorSchedule[getDateWeekday(exceptionDate)];
    if (!day?.isActive) return [];
    return TIME_OPTIONS.filter((time) => time >= day.startTime && time <= day.endTime);
  }, [doctorSchedule, exceptionDate]);
  const currentEditingDay = editingField ? doctorSchedule[editingField.day] : null;
  const currentEditingValue =
    editingField?.field === 'appointmentDurationMinutes'
      ? currentEditingDay?.appointmentDurationMinutes
      : editingField
        ? currentEditingDay?.[editingField.field]
        : null;

  const persistDay = useCallback(
    async (day: EditableDay) => {
      if (!clinicId || !selectedDoctorId) return;
      setIsSaving(true);
      try {
        await upsertDay({
          clinicId,
          doctorId: selectedDoctorId,
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
          appointmentDurationMinutes: day.appointmentDurationMinutes,
          isActive: day.isActive,
        });
      } catch (error) {
        Alert.alert('تعذر حفظ الجدول', getArabicError(error, 'حاول مرة أخرى.'));
      } finally {
        setIsSaving(false);
      }
    },
    [clinicId, selectedDoctorId, upsertDay],
  );

  const handleToggleDay = useCallback(
    async (day: DayOfWeek) => {
      const nextDay = {
        ...doctorSchedule[day],
        isActive: !doctorSchedule[day].isActive,
      };
      await persistDay(nextDay);
    },
    [doctorSchedule, persistDay],
  );

  const handlePickValue = useCallback(
    async (value: string | number) => {
      if (!editingField) return;
      const current = doctorSchedule[editingField.day];
      const nextDay: EditableDay = {
        ...current,
        [editingField.field]: value,
      } as EditableDay;

      if (editingField.field === 'startTime' && typeof value === 'string' && value >= current.endTime) {
        Alert.alert('وقت غير صالح', 'يجب أن يكون وقت البداية قبل وقت النهاية.');
        return;
      }
      if (editingField.field === 'endTime' && typeof value === 'string' && value <= current.startTime) {
        Alert.alert('وقت غير صالح', 'يجب أن يكون وقت النهاية بعد وقت البداية.');
        return;
      }

      setEditingField(null);
      await persistDay(nextDay);
    },
    [doctorSchedule, editingField, persistDay],
  );

  const handleAddException = useCallback(async () => {
    if (!clinicId || !selectedDoctorId || !exceptionDate) return;
    setIsSaving(true);
    try {
      if (exceptionMode === 'multi_day' && !exceptionEndDate) {
        Alert.alert('بيانات ناقصة', 'اختر تاريخ نهاية الاستثناء.');
        return;
      }
      if (exceptionMode === 'single_hour' && !exceptionStartTime) {
        Alert.alert('بيانات ناقصة', 'اختر ساعة الاستثناء.');
        return;
      }
      if (exceptionMode === 'time_range' && (!exceptionStartTime || !exceptionEndTime)) {
        Alert.alert('بيانات ناقصة', 'اختر وقت البداية ووقت النهاية.');
        return;
      }

      await addClinicException({
        clinicId,
        doctorId: selectedDoctorId,
        exceptionType: exceptionMode,
        exceptionDate,
        endDate: exceptionMode === 'multi_day' ? exceptionEndDate : undefined,
        startTime:
          exceptionMode === 'single_hour' || exceptionMode === 'time_range'
            ? exceptionStartTime
            : undefined,
        endTime: exceptionMode === 'time_range' ? exceptionEndTime : undefined,
        reason: exceptionReason.trim() || 'استثناء من المركز',
      });
      setExceptionModalVisible(false);
      setExceptionMode('full_day');
      setExceptionDate('');
      setExceptionEndDate('');
      setExceptionStartTime('');
      setExceptionEndTime('');
      setExceptionReason('');
    } catch (error) {
      Alert.alert('تعذر حفظ الاستثناء', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setIsSaving(false);
    }
  }, [
    addClinicException,
    clinicId,
    exceptionDate,
    exceptionEndDate,
    exceptionEndTime,
    exceptionMode,
    exceptionReason,
    exceptionStartTime,
    selectedDoctorId,
  ]);

  const handleRemoveException = useCallback(
    async (exceptionId: Id<'scheduleExceptions'>) => {
      setIsSaving(true);
      try {
        await removeException({ exceptionId });
      } catch (error) {
        Alert.alert('تعذر حذف الاستثناء', getArabicError(error, 'حاول مرة أخرى.'));
      } finally {
        setIsSaving(false);
      }
    },
    [removeException],
  );

  if (me === undefined || doctors === undefined || scheduleDocs === undefined || exceptionDocs === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل الجدول...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DoctorHeader
          title="جدول المركز"
          icon="calendar-outline"
          centerTitle
          subtitle="اختر المختص ثم عدّل أيام العمل والأوقات والاستثناءات من داخل المركز."
        />

        <DoctorSection title="اختر المختص">
          {doctorsList.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.doctorChips}
            >
              {doctorsList.map((doctor) => {
                const selected = doctor.doctorId === selectedDoctorId;
                return (
                  <Pressable
                    key={doctor._id}
                    onPress={() => setSelectedDoctorId(doctor.doctorId)}
                    style={[
                      styles.doctorChip,
                      selected && styles.doctorChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.doctorChipText,
                        selected && styles.doctorChipTextSelected,
                      ]}
                    >
                      {doctor.doctorName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>لا يوجد مختصون مقبولون داخل المركز حالياً.</Text>
          )}
        </DoctorSection>

        <DoctorSection
          title="الجدول الأسبوعي"
          subtitle={selectedDoctor ? `تعديل مواعيد ${selectedDoctor.doctorName}` : 'اختر مختصاً أولاً'}
        >
          {selectedDoctor ? (
            <View style={styles.scheduleList}>
              {DAYS.map((day) => {
                const data = doctorSchedule[day.value];
                return (
                  <View key={day.value} style={styles.dayCard}>
                    <View style={styles.dayHeader}>
                      <View style={styles.dayHeaderMain}>
                        <View
                          style={[
                            styles.dayStatusBadge,
                            data.isActive
                              ? styles.dayStatusBadgeActive
                              : styles.dayStatusBadgeInactive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayStatusText,
                              data.isActive
                                ? styles.dayStatusTextActive
                                : styles.dayStatusTextInactive,
                            ]}
                          >
                            {data.isActive ? 'مفعل' : 'متوقف'}
                          </Text>
                        </View>
                        <View style={styles.dayHeadingCopy}>
                          <Text style={styles.dayName}>{day.label}</Text>
                          <Text style={styles.daySummary}>
                            {data.isActive
                              ? `${data.startTime} - ${data.endTime} · ${data.appointmentDurationMinutes} د`
                              : 'غير ظاهر للعملاء حالياً'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.daySwitchWrap}>
                        <Switch
                          value={data.isActive}
                          onValueChange={() => void handleToggleDay(day.value)}
                          trackColor={{ false: theme.colors.border, true: theme.colors.secondary }}
                          thumbColor={data.isActive ? theme.colors.primary : '#F4F3F4'}
                        />
                      </View>
                    </View>

                    <View style={styles.dayFields}>
                      <Pressable
                        style={[
                          styles.valueChip,
                          !data.isActive && styles.valueChipDisabled,
                        ]}
                        onPress={() => setEditingField({ day: day.value, field: 'startTime' })}
                      >
                        <View style={styles.valueChipTop}>
                          <Ionicons name="play-forward-outline" size={14} color={theme.colors.textMuted} />
                          <Text style={styles.valueChipLabel}>من</Text>
                        </View>
                        <Text style={styles.valueChipText}>{data.startTime}</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.valueChip,
                          !data.isActive && styles.valueChipDisabled,
                        ]}
                        onPress={() => setEditingField({ day: day.value, field: 'endTime' })}
                      >
                        <View style={styles.valueChipTop}>
                          <Ionicons name="flag-outline" size={14} color={theme.colors.textMuted} />
                          <Text style={styles.valueChipLabel}>إلى</Text>
                        </View>
                        <Text style={styles.valueChipText}>{data.endTime}</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.valueChip,
                          !data.isActive && styles.valueChipDisabled,
                        ]}
                        onPress={() =>
                          setEditingField({
                            day: day.value,
                            field: 'appointmentDurationMinutes',
                          })
                        }
                      >
                        <View style={styles.valueChipTop}>
                          <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                          <Text style={styles.valueChipLabel}>المدة</Text>
                        </View>
                        <Text style={styles.valueChipText}>{data.appointmentDurationMinutes} د</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>اختر مختصاً لعرض جدول العمل.</Text>
          )}
        </DoctorSection>

        <DoctorSection
          title="استثناءات المختص"
          subtitle="إغلاق يوم محدد للمختص المختار داخل المركز"
          action={
            <Pressable
              onPress={() => setExceptionModalVisible(true)}
              disabled={!selectedDoctor}
              style={[
                styles.addButton,
                !selectedDoctor && styles.addButtonDisabled,
              ]}
            >
              <Ionicons
                name="add"
                size={16}
                color={selectedDoctor ? theme.colors.white : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.addButtonText,
                  !selectedDoctor && styles.addButtonTextDisabled,
                ]}
              >
                إضافة
              </Text>
            </Pressable>
          }
        >
          {doctorExceptions.length > 0 ? (
            <View style={styles.exceptionList}>
              {doctorExceptions.map((exception) => (
                <View key={exception._id} style={styles.exceptionRow}>
                  <View style={styles.exceptionCopy}>
                    <Text style={styles.exceptionDate}>{getExceptionModeLabel(exception.exceptionType ?? 'full_day')}</Text>
                    <Text style={styles.exceptionReason}>
                      {formatExceptionSummary(exception)}
                    </Text>
                    <Text style={styles.exceptionReason}>
                      {exception.reason?.trim() || 'استثناء من المركز'}
                    </Text>
                  </View>
                  <Pressable onPress={() => void handleRemoveException(exception._id)}>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>لا توجد استثناءات للمختص المختار.</Text>
          )}
        </DoctorSection>
      </ScrollView>

      <PickerModal
        visible={editingField !== null}
        title={
          editingField?.field === 'startTime'
            ? 'اختر وقت البداية'
            : editingField?.field === 'endTime'
              ? 'اختر وقت النهاية'
              : 'اختر مدة الموعد'
        }
        onClose={() => setEditingField(null)}
      >
        <View style={styles.pickerIntro}>
          <Text style={styles.pickerIntroLabel}>القيمة الحالية</Text>
          <Text style={styles.pickerIntroValue}>
            {typeof currentEditingValue === 'number'
              ? `${currentEditingValue} دقيقة`
              : currentEditingValue ?? '-'}
          </Text>
        </View>
        <View style={styles.optionGrid}>
          {(editingField?.field === 'appointmentDurationMinutes'
            ? [...DURATION_OPTIONS]
            : [...TIME_OPTIONS]
          ).map((item) => {
            const selected = item === currentEditingValue;
            return (
              <Pressable
                key={String(item)}
                onPress={() => void handlePickValue(item)}
                style={[styles.optionTile, selected && styles.optionTileSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {typeof item === 'number' ? `${item} دقيقة` : item}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </PickerModal>

      <PickerModal
        visible={exceptionModalVisible}
        title="إضافة استثناء"
        onClose={() => {
          setExceptionModalVisible(false);
          setExceptionMode('full_day');
          setExceptionDate('');
          setExceptionEndDate('');
          setExceptionStartTime('');
          setExceptionEndTime('');
          setExceptionReason('');
        }}
      >
        <Text style={styles.fieldLabel}>نوع الاستثناء</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeChips}
        >
          {([
            'single_hour',
            'time_range',
            'full_day',
            'multi_day',
          ] as ExceptionMode[]).map((mode) => {
            const selected = exceptionMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setExceptionMode(mode)}
                style={[styles.modeChip, selected && styles.modeChipSelected]}
              >
                <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>
                  {getExceptionModeLabel(mode)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.fieldLabel}>اختر اليوم</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateOptions}
        >
          {dateOptions.map((option) => {
            const selected = exceptionDate === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setExceptionDate(option.value);
                  if (exceptionEndDate && exceptionEndDate < option.value) {
                    setExceptionEndDate(option.value);
                  }
                }}
                style={[styles.dateChip, selected && styles.dateChipSelected]}
              >
                <Text style={[styles.dateChipTop, selected && styles.dateChipTextSelected]}>
                  {option.dayName}
                </Text>
                <Text style={[styles.dateChipNumber, selected && styles.dateChipTextSelected]}>
                  {option.dayNumber}
                </Text>
                <Text style={[styles.dateChipTop, selected && styles.dateChipTextSelected]}>
                  {option.monthName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {exceptionMode === 'multi_day' ? (
          <>
            <Text style={styles.fieldLabel}>إلى اليوم</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateOptions}
            >
              {dateOptions
                .filter((option) => !exceptionDate || option.value >= exceptionDate)
                .map((option) => {
                  const selected = exceptionEndDate === option.value;
                  return (
                    <Pressable
                      key={`end-${option.value}`}
                      onPress={() => setExceptionEndDate(option.value)}
                      style={[styles.dateChip, selected && styles.dateChipSelected]}
                    >
                      <Text style={[styles.dateChipTop, selected && styles.dateChipTextSelected]}>
                        {option.dayName}
                      </Text>
                      <Text style={[styles.dateChipNumber, selected && styles.dateChipTextSelected]}>
                        {option.dayNumber}
                      </Text>
                      <Text style={[styles.dateChipTop, selected && styles.dateChipTextSelected]}>
                        {option.monthName}
                      </Text>
                    </Pressable>
                  );
                })}
            </ScrollView>
          </>
        ) : null}

        {exceptionMode === 'single_hour' || exceptionMode === 'time_range' ? (
          <>
            <Text style={styles.fieldLabel}>من الساعة</Text>
            <View style={styles.inlineOptionGrid}>
              {exceptionTimeOptions.map((time) => {
                const selected = exceptionStartTime === time;
                return (
                  <Pressable
                    key={`start-${time}`}
                    onPress={() => setExceptionStartTime(time)}
                    style={[styles.inlineOptionTile, selected && styles.inlineOptionTileSelected]}
                  >
                    <Text style={[styles.inlineOptionText, selected && styles.inlineOptionTextSelected]}>
                      {time}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {exceptionMode === 'time_range' ? (
          <>
            <Text style={styles.fieldLabel}>إلى الساعة</Text>
            <View style={styles.inlineOptionGrid}>
              {exceptionTimeOptions
                .filter((time) => !exceptionStartTime || time > exceptionStartTime)
                .map((time) => {
                  const selected = exceptionEndTime === time;
                  return (
                    <Pressable
                      key={`end-${time}`}
                      onPress={() => setExceptionEndTime(time)}
                      style={[styles.inlineOptionTile, selected && styles.inlineOptionTileSelected]}
                    >
                      <Text style={[styles.inlineOptionText, selected && styles.inlineOptionTextSelected]}>
                        {time}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </>
        ) : null}

        <Text style={styles.fieldLabel}>السبب</Text>
        <TextInput
          style={styles.reasonInput}
          value={exceptionReason}
          onChangeText={setExceptionReason}
          placeholder="مثال: إجازة المختص"
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          textAlign="right"
        />

        <Pressable
          onPress={() => void handleAddException()}
          disabled={
            !exceptionDate ||
            !selectedDoctor ||
            isSaving ||
            (exceptionMode === 'multi_day' && !exceptionEndDate) ||
            (exceptionMode === 'single_hour' && !exceptionStartTime) ||
            (exceptionMode === 'time_range' && (!exceptionStartTime || !exceptionEndTime))
          }
          style={[
            styles.saveButton,
            (
              !exceptionDate ||
              !selectedDoctor ||
              isSaving ||
              (exceptionMode === 'multi_day' && !exceptionEndDate) ||
              (exceptionMode === 'single_hour' && !exceptionStartTime) ||
              (exceptionMode === 'time_range' && (!exceptionStartTime || !exceptionEndTime))
            ) && styles.saveButtonDisabled,
          ]}
        >
          <Text style={styles.saveButtonText}>حفظ الاستثناء</Text>
        </Pressable>
      </PickerModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing['3xl'],
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
  },
  doctorChips: {
    gap: theme.spacing.sm,
  },
  doctorChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
  },
  doctorChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  doctorChipText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
  },
  doctorChipTextSelected: {
    color: theme.colors.primary,
  },
  scheduleList: {
    gap: theme.spacing.sm,
  },
  dayCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  dayHeaderMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  dayHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  dayStatusBadge: {
    minHeight: 28,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayStatusBadgeActive: {
    backgroundColor: theme.colors.status.success.background,
    borderColor: theme.colors.status.success.border,
  },
  dayStatusBadgeInactive: {
    backgroundColor: theme.colors.status.neutral.background,
    borderColor: theme.colors.status.neutral.border,
  },
  dayStatusText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
  },
  dayStatusTextActive: {
    color: theme.colors.status.success.text,
  },
  dayStatusTextInactive: {
    color: theme.colors.status.neutral.text,
  },
  daySwitchWrap: {
    paddingTop: 2,
  },
  dayName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'right',
  },
  daySummary: {
    marginTop: 3,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'right',
  },
  dayFields: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  valueChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'space-between',
  },
  valueChipDisabled: {
    opacity: 0.72,
  },
  valueChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  valueChipLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    fontSize: 12,
  },
  valueChipText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    fontSize: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
  },
  addButtonDisabled: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.white,
    fontSize: 12,
  },
  addButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  exceptionList: {
    gap: theme.spacing.sm,
  },
  exceptionRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  exceptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  exceptionDate: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  exceptionReason: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  emptyText: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(13, 38, 59, 0.36)',
  },
  modalSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: theme.spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    flexGrow: 0,
  },
  modalBodyContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pickerIntro: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  pickerIntroLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'right',
  },
  pickerIntroValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
    fontSize: 15,
    textAlign: 'right',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  optionTile: {
    width: '31%',
    minHeight: 52,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  optionTileSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  optionText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    fontSize: 14,
  },
  optionTextSelected: {
    color: theme.colors.primary,
  },
  fieldLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    fontSize: 14,
  },
  dateOptions: {
    gap: theme.spacing.sm,
  },
  modeChips: {
    gap: theme.spacing.sm,
  },
  modeChip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  modeChipText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    fontSize: 12,
    textAlign: 'center',
  },
  modeChipTextSelected: {
    color: theme.colors.primary,
  },
  dateChip: {
    width: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 6,
  },
  dateChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  dateChipTop: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  dateChipNumber: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    fontSize: 18,
  },
  dateChipTextSelected: {
    color: theme.colors.primary,
  },
  inlineOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  inlineOptionTile: {
    width: '23%',
    minHeight: 44,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: theme.spacing.xs,
  },
  inlineOptionTileSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  inlineOptionText: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    color: theme.colors.textPrimary,
    fontSize: 13,
    textAlign: 'center',
  },
  inlineOptionTextSelected: {
    color: theme.colors.primary,
  },
  reasonInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textPrimary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.white,
  },
});
