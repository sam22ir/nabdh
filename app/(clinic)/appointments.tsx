import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DoctorHeader, DoctorSection } from "@/components/doctor-ui";
import { theme } from "@/lib/theme";
import type { Id } from "@/convex/_generated/dataModel";

type ClinicAppointmentStatus =
  | "confirmed"
  | "present"
  | "in_room"
  | "cancelled"
  | "completed"
  | "no_show";

type ClinicAppointmentCard = {
  _id: Id<"bookings">;
  doctorId: Id<"doctors">;
  clinicId: Id<"clinics">;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDuration: number;
  status: ClinicAppointmentStatus;
  doctorName: string;
  patientName: string;
};

const STATUS_CONFIG: Record<
  ClinicAppointmentStatus,
  { label: string; color: string; backgroundColor: string }
> = {
  confirmed: {
    label: "بانتظار المريض",
    color: theme.colors.status.warning.text,
    backgroundColor: theme.colors.status.warning.background,
  },
  present: {
    label: "حاضر",
    color: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  in_room: {
    label: "داخل عند الطبيب",
    color: "#7C3AED",
    backgroundColor: "#F3E8FF",
  },
  completed: {
    label: "تم",
    color: theme.colors.textSecondary,
    backgroundColor: "#F3F4F6",
  },
  no_show: {
    label: "غائب",
    color: theme.colors.status.danger.text,
    backgroundColor: theme.colors.status.danger.background,
  },
  cancelled: {
    label: "ملغى",
    color: theme.colors.danger,
    backgroundColor: "#FDEDEC",
  },
};

export default function ClinicAppointmentsScreen() {
  const appointments = useQuery(api.bookings.listMyClinicAppointments, {}) as
    | ClinicAppointmentCard[]
    | undefined;
  const syncMyClinicAppointmentStates = useMutation(
    api.bookings.syncMyClinicAppointmentStates,
  );
  const markPresent = useMutation(api.bookings.markPresent);
  const markCompleted = useMutation(api.bookings.markCompleted);
  const addEncounterNote = useMutation(api.encounterNotes.add);
  const {
    results: historyAppointments,
    status: historyStatus,
    loadMore: loadMoreHistory,
  } = usePaginatedQuery(api.bookings.listClinicHistory, {}, { initialNumItems: 20 });
  const [viewMode, setViewMode] = useState<"current" | "history">("current");
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] =
    useState<Id<"doctors"> | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<ClinicAppointmentCard | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const selectedNotes = useQuery(
    api.encounterNotes.listForBooking,
    selectedAppointment ? { bookingId: selectedAppointment._id } : "skip",
  ) as Array<{
    _id: string;
    authorName: string;
    visibility: string;
    content: string;
    createdAt: number;
  }> | undefined;
  useEffect(() => {
    void syncMyClinicAppointmentStates({});
  }, [syncMyClinicAppointmentStates]);

  const visibleAppointments = useMemo(
    () => viewMode === "history"
      ? (historyAppointments as ClinicAppointmentCard[])
      : (appointments ?? []),
    [appointments, historyAppointments, viewMode],
  );
  const sortedAppointments = useMemo(
    () =>
      [...visibleAppointments].sort((a, b) => {
        const dateOrder = b.appointmentDate.localeCompare(a.appointmentDate);
        return dateOrder || a.appointmentTime.localeCompare(b.appointmentTime);
      }),
    [visibleAppointments],
  );

  const doctorOptions = useMemo(() => {
    const map = new Map<
      string,
      { doctorId: Id<"doctors">; doctorName: string; appointmentCount: number }
    >();
    for (const appointment of sortedAppointments) {
      const existing = map.get(appointment.doctorId);
      if (existing) {
        existing.appointmentCount += 1;
        continue;
      }
      map.set(appointment.doctorId, {
        doctorId: appointment.doctorId,
        doctorName: appointment.doctorName,
        appointmentCount: 1,
      });
    }
    return [...map.values()];
  }, [sortedAppointments]);

  useEffect(() => {
    if (!doctorOptions.length) {
      setSelectedDoctorId(null);
      return;
    }
    if (
      !selectedDoctorId ||
      !doctorOptions.some((doctor) => doctor.doctorId === selectedDoctorId)
    ) {
      setSelectedDoctorId(doctorOptions[0].doctorId);
    }
  }, [doctorOptions, selectedDoctorId]);

  const filteredAppointments = useMemo(
    () =>
      selectedDoctorId
        ? sortedAppointments.filter(
            (appointment) => appointment.doctorId === selectedDoctorId,
          )
        : sortedAppointments,
    [selectedDoctorId, sortedAppointments],
  );

  const handleMarkPresent = async (bookingId: Id<"bookings">) => {
    setActiveBookingId(bookingId);
    try {
      await markPresent({ bookingId });
      await syncMyClinicAppointmentStates({});
    } finally {
      setActiveBookingId(null);
    }
  };

  const handleMarkCompleted = async (bookingId: Id<"bookings">) => {
    setActiveBookingId(bookingId);
    try {
      await markCompleted({ bookingId });
      await syncMyClinicAppointmentStates({});
    } finally {
      setActiveBookingId(null);
    }
  };

  const handleAddNote = async () => {
    if (!selectedAppointment || !noteText.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await addEncounterNote({
        bookingId: selectedAppointment._id,
        content: noteText,
        visibility: "care_team",
      });
      setNoteText("");
    } finally {
      setSavingNote(false);
    }
  };

  const handleViewModeChange = (nextMode: "current" | "history") => {
    if (nextMode === viewMode) return;
    setSelectedAppointment(null);
    setSelectedDoctorId(null);
    setViewMode(nextMode);
  };

  const selectedAppointmentStatus = selectedAppointment
    ? STATUS_CONFIG[selectedAppointment.status]
    : null;
  const selectedAppointmentBusy =
    selectedAppointment && activeBookingId === selectedAppointment._id;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <DoctorHeader
          title="مواعيد العيادة"
          icon="calendar-outline"
          centerTitle
        />
        <View style={styles.viewSwitcher}>
          {([['current', 'المواعيد'], ['history', 'السجل']] as const).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => handleViewModeChange(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === value }}
              accessibilityLabel={value === "history" ? "عرض سجل المواعيد السابقة" : "عرض المواعيد الحالية والقادمة"}
              style={[styles.viewSwitcherButton, viewMode === value && styles.viewSwitcherButtonActive]}
            >
              <Text style={[styles.viewSwitcherText, viewMode === value && styles.viewSwitcherTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <DoctorSection title="اختر الطبيب">
          {doctorOptions.length > 0 ? (
            <View style={styles.doctorGrid}>
              {doctorOptions.map((doctor) => {
                const selected = doctor.doctorId === selectedDoctorId;
                return (
                  <Pressable
                    key={doctor.doctorId}
                    onPress={() => setSelectedDoctorId(doctor.doctorId)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`عرض مواعيد ${doctor.doctorName}`}
                    style={({ pressed }) => [
                      styles.doctorCard,
                      selected && styles.doctorCardSelected,
                      pressed && styles.doctorCardPressed,
                    ]}
                  >
                    <Text style={styles.doctorCardName} numberOfLines={2}>
                      {doctor.doctorName}
                    </Text>
                    <View
                      style={[
                        styles.doctorCardCount,
                        selected && styles.doctorCardCountSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.doctorCardCountValue,
                          selected && styles.doctorCardCountValueSelected,
                        ]}
                      >
                        {doctor.appointmentCount}
                      </Text>
                      <Text
                        style={[
                          styles.doctorCardCountLabel,
                          selected && styles.doctorCardCountLabelSelected,
                        ]}
                      >
                        موعد
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              لا يوجد أطباء لعرض مواعيدهم حالياً.
            </Text>
          )}
        </DoctorSection>
        <DoctorSection
          title={viewMode === "history" ? "سجل المواعيد السابقة" : "المواعيد الحالية والقادمة"}
        >
          {(viewMode === "current" && appointments === undefined) ||
          (viewMode === "history" && historyStatus === "LoadingFirstPage") ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : filteredAppointments.length > 0 ? (
            <View style={styles.list}>
              {filteredAppointments.map((appointment, index) => {
                const status = STATUS_CONFIG[appointment.status];
                const isActive = activeBookingId === appointment._id;

                return (
                  <Pressable
                    key={appointment._id}
                    onPress={() => setSelectedAppointment(appointment)}
                    style={[
                      styles.row,
                      index === filteredAppointments.length - 1 &&
                        styles.rowLast,
                    ]}
                  >
                    <View style={styles.rowTop}>
                      <View style={styles.timeBlock}>
                        <Text style={styles.timeValue}>
                          {appointment.appointmentTime}
                        </Text>
                        <Text style={styles.timeDate}>
                          {appointment.appointmentDate}
                        </Text>
                        <Text style={styles.timeDuration}>
                          {appointment.appointmentDuration} د
                        </Text>
                      </View>

                      <View style={styles.rowMain}>
                        <View style={styles.rowHeader}>
                          <View style={styles.rowTitleGroup}>
                            <Text style={styles.rowTitle}>
                              {appointment.patientName}
                            </Text>
                            <Text style={styles.rowSubtitle}>
                              {appointment.doctorName}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: status.backgroundColor },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                { color: status.color },
                              ]}
                            >
                              {status.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.rowFooter}>
                          <View style={styles.rowHint}>
                            <Ionicons
                              name="calendar-outline"
                              size={14}
                              color={theme.colors.textMuted}
                            />
                            <Text style={styles.rowHintText}>
                              اضغط لعرض التفاصيل
                            </Text>
                          </View>
                          <View style={styles.rowChevron}>
                            <Ionicons
                              name="chevron-back"
                              size={18}
                              color={theme.colors.textSecondary}
                            />
                          </View>
                        </View>
                      </View>
                    </View>

                    {(appointment.status === "confirmed" ||
                      appointment.status === "in_room") && (
                      <View style={styles.actionsRow}>
                        {appointment.status === "confirmed" ? (
                          <Pressable
                            style={({ pressed }) => [
                              styles.actionButton,
                              styles.presentButton,
                              pressed && styles.actionPressed,
                            ]}
                            onPress={() =>
                              void handleMarkPresent(appointment._id)
                            }
                            disabled={isActive}
                          >
                            <Text style={styles.presentButtonText}>حاضر</Text>
                          </Pressable>
                        ) : null}

                        {appointment.status === "in_room" ? (
                          <Pressable
                            style={({ pressed }) => [
                              styles.actionButton,
                              styles.doneButton,
                              pressed && styles.actionPressed,
                            ]}
                            onPress={() =>
                              void handleMarkCompleted(appointment._id)
                            }
                            disabled={isActive}
                          >
                            <Text style={styles.doneButtonText}>تم</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {viewMode === "history"
                ? "لا توجد مواعيد سابقة في السجل."
                : "لا توجد مواعيد حالية أو قادمة داخل العيادة."}
            </Text>
          )}
          {viewMode === "history" && historyStatus === "CanLoadMore" ? (
            <Pressable style={styles.loadMoreButton} onPress={() => loadMoreHistory(20)}>
              <Text style={styles.loadMoreText}>عرض المزيد</Text>
            </Pressable>
          ) : null}
        </DoctorSection>
      </ScrollView>

      <Modal
        visible={selectedAppointment !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAppointment(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedAppointment(null)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تفاصيل الموعد</Text>
              <Pressable
                onPress={() => setSelectedAppointment(null)}
                style={styles.modalCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            </View>

            {selectedAppointment ? (
              <ScrollView
                style={styles.modalContentScroll}
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View
                  style={[
                    styles.modalHero,
                    {
                      backgroundColor:
                        selectedAppointmentStatus?.backgroundColor ??
                        theme.colors.surfaceMuted,
                      borderColor:
                        selectedAppointmentStatus?.color ?? theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.modalHeroTop}>
                    <View
                      style={[
                        styles.modalStatusBadge,
                        {
                          backgroundColor:
                            selectedAppointmentStatus?.backgroundColor ??
                            theme.colors.secondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalStatusText,
                          {
                            color:
                              selectedAppointmentStatus?.color ??
                              theme.colors.primary,
                          },
                        ]}
                      >
                        {selectedAppointmentStatus?.label ?? ""}
                      </Text>
                    </View>
                    <View style={styles.modalHeroIcon}>
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={theme.colors.primary}
                      />
                    </View>
                  </View>
                  <Text style={styles.modalPatientName}>
                    {selectedAppointment.patientName}
                  </Text>
                  <Text style={styles.modalPatientMeta}>
                    موعد عند {selectedAppointment.doctorName}
                  </Text>
                </View>

                <View style={styles.modalStatsGrid}>
                  <View style={styles.modalStatCard}>
                    <Text style={styles.modalStatLabel}>الوقت</Text>
                    <Text style={styles.modalStatPrimary}>
                      {selectedAppointment.appointmentTime}
                    </Text>
                    <Text style={styles.modalStatSecondary}>
                      {selectedAppointment.appointmentDate}
                    </Text>
                  </View>
                  <View style={styles.modalStatCard}>
                    <Text style={styles.modalStatLabel}>المدة</Text>
                    <Text style={styles.modalStatPrimary}>
                      {selectedAppointment.appointmentDuration} دقيقة
                    </Text>
                    <Text style={styles.modalStatSecondary}>
                      حسب جدول العيادة
                    </Text>
                  </View>
                </View>

                <View style={styles.modalInfoSection}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.patientName}
                    </Text>
                    <Text style={styles.detailLabel}>المريض</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.doctorName}
                    </Text>
                    <Text style={styles.detailLabel}>الطبيب</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.appointmentDate} -{" "}
                      {selectedAppointment.appointmentTime}
                    </Text>
                    <Text style={styles.detailLabel}>الموعد</Text>
                  </View>
                </View>

                <View style={styles.notesSection}>
                  <Text style={styles.notesTitle}>ملاحظات فريق الرعاية</Text>
                  <ScrollView style={styles.notesTimeline} nestedScrollEnabled>
                    {selectedNotes === undefined ? (
                      <ActivityIndicator color={theme.colors.primary} />
                    ) : selectedNotes.length ? (
                      selectedNotes.map((note) => (
                        <View key={note._id} style={styles.noteRow}>
                          <Text style={styles.noteAuthor}>{note.authorName}</Text>
                          <Text style={styles.noteContent}>{note.content}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.notesEmpty}>لا توجد ملاحظات لهذا الموعد.</Text>
                    )}
                  </ScrollView>
                  <TextInput
                    style={styles.noteInput}
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="أضف ملاحظة مشتركة..."
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    textAlign="right"
                  />
                  <Pressable
                    style={[styles.addNoteButton, (!noteText.trim() || savingNote) && styles.buttonDisabled]}
                    disabled={!noteText.trim() || savingNote}
                    onPress={() => void handleAddNote()}
                  >
                    <Ionicons name="add" size={18} color={theme.colors.white} />
                    <Text style={styles.addNoteText}>{savingNote ? "جاري الحفظ" : "إضافة ملاحظة"}</Text>
                  </Pressable>
                </View>

                {selectedAppointment.status === "confirmed" ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalActionButton,
                      styles.presentButton,
                      pressed && styles.actionPressed,
                    ]}
                    onPress={() =>
                      void handleMarkPresent(selectedAppointment._id)
                    }
                    disabled={selectedAppointmentBusy}
                  >
                    <Text style={styles.presentButtonText}>حاضر</Text>
                  </Pressable>
                ) : null}

                {selectedAppointment.status === "in_room" ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalActionButton,
                      styles.doneButton,
                      pressed && styles.actionPressed,
                    ]}
                    onPress={() =>
                      void handleMarkCompleted(selectedAppointment._id)
                    }
                    disabled={selectedAppointmentBusy}
                  >
                    <Text style={styles.doneButtonText}>تم</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  },
  viewSwitcher: {
    flexDirection: "row",
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 4,
    gap: 4,
  },
  viewSwitcherButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.sm,
  },
  viewSwitcherButtonActive: {
    backgroundColor: theme.colors.surfaceRaised,
    ...theme.shadows.sm,
  },
  viewSwitcherText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  viewSwitcherTextActive: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },
  loadingBox: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  doctorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  doctorCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 104,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  doctorCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
    ...theme.shadows.sm,
  },
  doctorCardPressed: {
    opacity: 0.76,
  },
  doctorCardCount: {
    alignSelf: "flex-start",
    minWidth: 64,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  doctorCardCountSelected: {
    backgroundColor: theme.colors.primary,
  },
  doctorCardCountValue: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 18,
    color: theme.colors.primary,
    textAlign: "center",
  },
  doctorCardCountValueSelected: {
    color: theme.colors.white,
  },
  doctorCardCountLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  doctorCardCountLabelSelected: {
    color: theme.colors.white,
  },
  doctorCardName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: "right",
    writingDirection: "rtl",
    minHeight: 46,
    maxWidth: "100%",
  },
  list: {
    gap: theme.spacing.sm,
  },
  row: {
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    padding: theme.spacing.md,
  },
  rowLast: {
    marginBottom: 0,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: theme.spacing.md,
  },
  timeBlock: {
    width: 88,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    gap: 2,
  },
  timeValue: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 18,
    color: theme.colors.primary,
    textAlign: "center",
  },
  timeDate: {
    fontFamily: theme.typography.fontFamily.latin,
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  timeDuration: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.sm,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  rowTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  rowSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: "right",
    marginTop: 3,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
  },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  rowHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  rowHintText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: "right",
  },
  rowChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    minWidth: 104,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
  },
  presentButton: {
    backgroundColor: theme.colors.primary,
  },
  presentButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.arabicBold,
  },
  doneButton: {
    backgroundColor: theme.colors.textPrimary,
  },
  doneButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.arabicBold,
  },
  actionPressed: {
    opacity: 0.88,
  },
  emptyText: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    textAlign: "right",
  },
  loadMoreButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceRaised,
    marginTop: theme.spacing.md,
  },
  loadMoreText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(13, 38, 59, 0.36)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "92%",
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    fontSize: 18,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  modalContentScroll: {
    flexShrink: 1,
  },
  modalHero: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  modalHeroIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  modalStatusBadge: {
    alignSelf: "flex-end",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modalStatusText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
  },
  modalPatientName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  modalPatientMeta: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: "right",
  },
  modalStatsGrid: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  modalStatCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    justifyContent: "space-between",
    gap: theme.spacing.xs,
  },
  modalStatLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: "right",
  },
  modalStatPrimary: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  modalStatSecondary: {
    fontFamily: theme.typography.fontFamily.latin,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: "right",
  },
  modalInfoSection: {
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  notesSection: {
    gap: theme.spacing.sm,
  },
  notesTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  notesTimeline: {
    maxHeight: 130,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  noteRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  noteAuthor: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: "right",
  },
  noteContent: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  notesEmpty: {
    paddingVertical: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  noteInput: {
    minHeight: 70,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textPrimary,
    textAlignVertical: "top",
  },
  addNoteButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  addNoteText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  detailValue: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    fontSize: 14,
    textAlign: "right",
  },
  modalActionButton: {
    marginTop: theme.spacing.sm,
    minHeight: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
