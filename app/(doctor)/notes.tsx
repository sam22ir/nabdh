import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, usePaginatedQuery, useQuery } from '@/lib/backend';

import { api } from '@/lib/backend/api';
import type { Id } from '@/lib/backend/types';
import { DoctorHeader, DoctorSection } from '@/components/doctor-ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';

type Visibility = 'doctor_private' | 'care_team';
type AppointmentStatus =
  | 'confirmed'
  | 'present'
  | 'in_room'
  | 'cancelled'
  | 'completed'
  | 'no_show';

type Encounter = {
  _id: Id<'bookings'>;
  patientId: Id<'patients'>;
  profileId?: string;
  profileName?: string;
  patientName: string;
  patientPhone?: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicName: string;
  visitType: 'first' | 'followup' | 'consultation';
  status: AppointmentStatus;
};

type EncounterNote = {
  _id: string;
  authorName: string;
  visibility: Visibility | 'patient_visible';
  content: string;
  createdAt: number;
};

type PatientGroup = {
  key: string;
  name: string;
  phone?: string;
  appointments: Encounter[];
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  confirmed: 'مؤكد',
  present: 'حاضر',
  in_room: 'داخل المركز',
  cancelled: 'ملغى',
  completed: 'مكتمل',
  no_show: 'لم يحضر',
};

const VISIT_LABELS: Record<Encounter['visitType'], string> = {
  first: 'زيارة أولى',
  followup: 'متابعة',
  consultation: 'استشارة',
};

function patientKey(encounter: Encounter) {
  return encounter.profileId
    ? `profile:${encounter.profileId}`
    : `patient:${encounter.patientId}`;
}

function formatNoteDate(timestamp: number) {
  return new Intl.DateTimeFormat('ar-DZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function AppointmentNotes({
  appointment,
  initiallyComposing,
}: {
  appointment: Encounter;
  initiallyComposing: boolean;
}) {
  const notes = useQuery(api.encounterNotes.listForBooking, {
    bookingId: appointment._id,
  }) as EncounterNote[] | undefined;
  const addNote = useMutation(api.encounterNotes.add);
  const [composing, setComposing] = useState(initiallyComposing);
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('care_team');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      await addNote({ bookingId: appointment._id, content, visibility });
      setContent('');
      setComposing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.appointmentBlock}>
      <View style={styles.appointmentHeader}>
        <View style={styles.appointmentDateBlock}>
          <Text style={styles.appointmentDate}>{appointment.appointmentDate}</Text>
          <Text style={styles.appointmentTime}>{appointment.appointmentTime}</Text>
        </View>
        <View style={styles.appointmentTitleBlock}>
          <Text style={styles.appointmentClinic} numberOfLines={1}>
            {appointment.clinicName}
          </Text>
          <Text style={styles.appointmentMeta}>
            {VISIT_LABELS[appointment.visitType]} · {STATUS_LABELS[appointment.status]}
          </Text>
        </View>
      </View>

      <View style={styles.noteTimeline}>
        {notes === undefined ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : notes.length ? (
          notes.map((note) => (
            <View key={note._id} style={styles.noteRow}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteAuthor}>{note.authorName}</Text>
                <Text style={styles.noteMeta}>
                  {note.visibility === 'doctor_private' ? 'خاصة' : 'فريق الرعاية'} ·{' '}
                  {formatNoteDate(note.createdAt)}
                </Text>
              </View>
              <Text style={styles.noteContent}>{note.content}</Text>
            </View>
          ))
        ) : (
          <View style={styles.noNoteRow}>
            <Ionicons name="document-text-outline" size={17} color={theme.colors.textMuted} />
            <Text style={styles.noNoteText}>لا توجد ملاحظة لهذا الموعد</Text>
          </View>
        )}
      </View>

      {composing ? (
        <View style={styles.composer}>
          <View style={styles.visibilityControl}>
            {([
              ['care_team', 'فريق الرعاية', 'people-outline'],
              ['doctor_private', 'خاصة بي', 'lock-closed-outline'],
            ] as const).map(([value, label, icon]) => {
              const active = visibility === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setVisibility(value)}
                  style={[styles.visibilityButton, active && styles.visibilityButtonActive]}
                >
                  <Ionicons
                    name={icon}
                    size={15}
                    color={active ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text style={[styles.visibilityText, active && styles.visibilityTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={styles.noteInput}
            value={content}
            onChangeText={setContent}
            placeholder="اكتب ملاحظة عن هذه الزيارة..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            maxLength={4000}
            textAlign="right"
            textAlignVertical="top"
          />
          <View style={styles.composerActions}>
            <Pressable style={styles.cancelButton} onPress={() => setComposing(false)}>
              <Text style={styles.cancelButtonText}>إلغاء</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, (!content.trim() || saving) && styles.buttonDisabled]}
              onPress={() => void handleSave()}
              disabled={!content.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Ionicons name="add" size={17} color={theme.colors.white} />
              )}
              <Text style={styles.saveButtonText}>{saving ? 'جاري الحفظ' : 'إضافة'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addNoteButton} onPress={() => setComposing(true)}>
          <Ionicons name="add" size={17} color={theme.colors.primary} />
          <Text style={styles.addNoteText}>إضافة ملاحظة لهذا الموعد</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function DoctorNotesScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const { results, status, loadMore } = usePaginatedQuery(
    api.bookings.listDoctorHistory,
    {},
    { initialNumItems: 40 },
  );
  const encounters = results as Encounter[];
  const [search, setSearch] = useState('');
  const [selectedPatientKey, setSelectedPatientKey] = useState<string | null>(null);

  const patients = useMemo(() => {
    const groups = new Map<string, PatientGroup>();
    for (const encounter of encounters) {
      const key = patientKey(encounter);
      const group = groups.get(key);
      if (group) {
        group.appointments.push(encounter);
      } else {
        groups.set(key, {
          key,
          name: encounter.profileName ?? encounter.patientName,
          phone: encounter.patientPhone,
          appointments: [encounter],
        });
      }
    }
    return [...groups.values()].map((group) => ({
      ...group,
      appointments: [...group.appointments].sort((a, b) =>
        `${b.appointmentDate}T${b.appointmentTime}`.localeCompare(
          `${a.appointmentDate}T${a.appointmentTime}`,
        ),
      ),
    }));
  }, [encounters]);

  useEffect(() => {
    if (!params.bookingId || selectedPatientKey) return;
    const encounter = encounters.find((item) => item._id === params.bookingId);
    if (encounter) setSelectedPatientKey(patientKey(encounter));
  }, [encounters, params.bookingId, selectedPatientKey]);

  const selectedPatient = patients.find((patient) => patient.key === selectedPatientKey) ?? null;
  const filteredPatients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return patients;
    return patients.filter((patient) =>
      [patient.name, patient.phone ?? ''].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [patients, search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <DoctorHeader title="الملاحظات" icon="document-text-outline" />

          {selectedPatient ? (
            <>
              <Pressable
                style={styles.backButton}
                onPress={() => setSelectedPatientKey(null)}
                accessibilityLabel="العودة إلى العملاء"
              >
                <Ionicons name="arrow-forward" size={18} color={theme.colors.primary} />
                <Text style={styles.backButtonText}>العملاء</Text>
              </Pressable>
              <DoctorSection
                title={selectedPatient.name}
                subtitle={`${selectedPatient.appointments.length} موعد في السجل${selectedPatient.phone ? ` · ${selectedPatient.phone}` : ''}`}
              >
                <View style={styles.appointmentsList}>
                  {selectedPatient.appointments.map((appointment) => (
                    <AppointmentNotes
                      key={appointment._id}
                      appointment={appointment}
                      initiallyComposing={appointment._id === params.bookingId}
                    />
                  ))}
                </View>
              </DoctorSection>
            </>
          ) : (
            <>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="ابحث باسم العميل أو رقم الهاتف"
                  placeholderTextColor={theme.colors.textSecondary}
                  textAlign="right"
                />
                {search ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <DoctorSection
                title="العملاء"
                subtitle="اختر عميلاً لعرض مواعيده وملاحظات كل زيارة"
              >
                {status === 'LoadingFirstPage' ? (
                  <View style={styles.loadingState}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : filteredPatients.length ? (
                  <View style={styles.patientList}>
                    {filteredPatients.map((patient) => {
                      const latest = patient.appointments[0];
                      return (
                        <Pressable
                          key={patient.key}
                          onPress={() => setSelectedPatientKey(patient.key)}
                          accessibilityRole="button"
                          accessibilityLabel={`فتح سجل ${patient.name}`}
                          style={({ pressed }) => [
                            styles.patientRow,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <View style={styles.avatar}>
                            <Ionicons name="person-outline" size={20} color={theme.colors.official} />
                          </View>
                          <View style={styles.patientMain}>
                            <Text style={styles.patientName} numberOfLines={1}>{patient.name}</Text>
                            <Text style={styles.patientMeta} numberOfLines={1}>
                              آخر موعد {latest.appointmentDate} · {patient.appointments.length} موعد
                            </Text>
                          </View>
                          <Ionicons name="chevron-back" size={18} color={theme.colors.textMuted} />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={25} color={theme.colors.textMuted} />
                    <Text style={styles.emptyTitle}>لا يوجد عملاء مطابقون</Text>
                    <Text style={styles.emptyText}>جرّب اسماً أو رقم هاتف مختلفاً.</Text>
                  </View>
                )}

                {status === 'CanLoadMore' ? (
                  <Pressable style={styles.loadMoreButton} onPress={() => loadMore(40)}>
                    <Text style={styles.loadMoreText}>تحميل المزيد من السجل</Text>
                  </Pressable>
                ) : status === 'LoadingMore' ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : null}
              </DoctorSection>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing['4xl'], gap: theme.spacing.lg },
  searchBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised },
  searchInput: { flex: 1, minWidth: 0, fontFamily: theme.typography.fontFamily.arabic, fontSize: 14, color: theme.colors.textPrimary },
  loadingState: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  patientList: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  patientRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowPressed: { opacity: 0.72 },
  avatar: { width: 42, height: 42, borderRadius: theme.borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceMuted },
  patientMain: { flex: 1, minWidth: 0 },
  patientName: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 15, color: theme.colors.textPrimary, textAlign: rtlTextAlign() },
  patientMeta: { marginTop: 3, fontFamily: theme.typography.fontFamily.arabic, fontSize: 11, color: theme.colors.textSecondary, textAlign: rtlTextAlign() },
  emptyState: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs },
  emptyTitle: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 14, color: theme.colors.textPrimary },
  emptyText: { fontFamily: theme.typography.fontFamily.arabic, fontSize: 12, color: theme.colors.textSecondary },
  loadMoreButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceRaised },
  loadMoreText: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 13, color: theme.colors.primary },
  backButton: { alignSelf: 'flex-end', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm },
  backButtonText: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 13, color: theme.colors.primary },
  appointmentsList: { gap: theme.spacing.lg },
  appointmentBlock: { gap: theme.spacing.md, paddingBottom: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.borderStrong },
  appointmentHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  appointmentDateBlock: { minWidth: 88, alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.surfaceMuted },
  appointmentDate: { fontFamily: theme.typography.fontFamily.latinMedium, fontSize: 11, color: theme.colors.textSecondary },
  appointmentTime: { marginTop: 2, fontFamily: theme.typography.fontFamily.latinMedium, fontSize: 16, color: theme.colors.official },
  appointmentTitleBlock: { flex: 1, minWidth: 0 },
  appointmentClinic: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 14, color: theme.colors.textPrimary, textAlign: rtlTextAlign() },
  appointmentMeta: { marginTop: 3, fontFamily: theme.typography.fontFamily.arabic, fontSize: 11, color: theme.colors.textSecondary, textAlign: rtlTextAlign() },
  noteTimeline: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  noteRow: { paddingVertical: theme.spacing.md, gap: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm },
  noteAuthor: { flex: 1, fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 12, color: theme.colors.textPrimary, textAlign: rtlTextAlign() },
  noteMeta: { maxWidth: '62%', fontFamily: theme.typography.fontFamily.arabic, fontSize: 10, color: theme.colors.textSecondary, textAlign: 'right' },
  noteContent: { fontFamily: theme.typography.fontFamily.arabic, fontSize: 14, lineHeight: 23, color: theme.colors.textPrimary, textAlign: rtlTextAlign() },
  noNoteRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
  noNoteText: { fontFamily: theme.typography.fontFamily.arabic, fontSize: 13, color: theme.colors.textSecondary },
  addNoteButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, borderRadius: theme.borderRadius.sm, borderWidth: 1, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceRaised },
  addNoteText: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 12, color: theme.colors.primary },
  composer: { gap: theme.spacing.sm },
  visibilityControl: { flexDirection: 'row', gap: theme.spacing.sm },
  visibilityButton: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, borderRadius: theme.borderRadius.sm, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised },
  visibilityButtonActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.secondary },
  visibilityText: { fontFamily: theme.typography.fontFamily.arabic, fontSize: 11, color: theme.colors.textSecondary },
  visibilityTextActive: { fontFamily: theme.typography.fontFamily.arabicBold, color: theme.colors.primary },
  noteInput: { minHeight: 96, borderRadius: theme.borderRadius.sm, borderWidth: 1, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceRaised, padding: theme.spacing.md, fontFamily: theme.typography.fontFamily.arabic, fontSize: 14, lineHeight: 22, color: theme.colors.textPrimary },
  composerActions: { flexDirection: 'row', gap: theme.spacing.sm },
  cancelButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadius.sm, borderWidth: 1, borderColor: theme.colors.border },
  cancelButtonText: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 12, color: theme.colors.textSecondary },
  saveButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.primary },
  saveButtonText: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 12, color: theme.colors.white },
  buttonDisabled: { opacity: 0.45 },
});
