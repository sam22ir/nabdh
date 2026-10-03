import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { Ionicons } from '@expo/vector-icons';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import SearchBar from '@/components/SearchBar';
import { DoctorSection } from '@/components/doctor-ui';
import { Badge, Button, Panel } from '@/components/ui';
import { theme } from '@/lib/theme';

type MembershipCard = {
  _id: Id<'clinicMemberships'>;
  doctorId: Id<'doctors'>;
  doctorName: string;
  doctorPhone?: string;
  clinicName?: string;
};

type DoctorSearchCard = {
  _id: Id<'doctors'>;
  fullNameAr?: string;
  fullName?: string;
  specialty?: { nameAr?: string | null } | null;
  phone?: string;
  isAvailableToday?: boolean;
};

function doctorDisplayName(doctor: DoctorSearchCard | MembershipCard) {
  return 'doctorName' in doctor
    ? doctor.doctorName || 'مختص'
    : doctor.fullNameAr ?? doctor.fullName ?? 'مختص';
}

function DoctorResultRow({
  title,
  subtitle,
  meta,
  badge,
  actions,
  variant = 'default',
}: {
  title: string;
  subtitle: string;
  meta?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: 'default' | 'member';
}) {
  const hasSingleAction = React.Children.count(actions) === 1;
  const initial = title.trim().charAt(0) || 'ط';
  const isMember = variant === 'member';

  return (
    <Panel style={[styles.rowPanel, isMember && styles.memberPanel]} elevated={isMember}>
      <View style={[styles.rowHeader, isMember && styles.memberHeader]}>
        <View style={styles.rowIdentity}>
          <View style={[styles.avatar, isMember && styles.memberAvatar]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.rowCopy}>
            {isMember ? (
              <Text style={styles.memberEyebrow}>مختص داخل المركز</Text>
            ) : null}
            <View style={[styles.titleRow, isMember && styles.memberTitleRow]}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {title}
              </Text>
              {isMember ? <View style={styles.memberBadgeInline}>{badge}</View> : null}
            </View>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
        {!isMember ? badge : null}
      </View>
      {meta ? (
        <View style={[styles.metaRow, isMember && styles.memberMetaRow]}>
          <Ionicons
            name="call-outline"
            size={14}
            color={isMember ? theme.colors.info : theme.colors.textMuted}
          />
          <Text style={styles.rowMeta}>{meta}</Text>
        </View>
      ) : null}
      {actions ? (
        <View
          style={[
            styles.actionsRow,
            hasSingleAction && styles.actionsRowSingle,
            isMember && styles.memberActionsRow,
          ]}
        >
          {actions}
        </View>
      ) : null}
    </Panel>
  );
}

function getArabicError(error: unknown, fallback: string) {
  if (error instanceof ConvexError) {
    return typeof error.message === 'string' ? error.message : fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export default function ClinicDoctorsManager() {
  const [searchText, setSearchText] = useState('');
  const [activeInviteDoctorId, setActiveInviteDoctorId] = useState<string | null>(null);
  const [activeMembershipId, setActiveMembershipId] = useState<string | null>(null);
  const [doctorPendingRemoval, setDoctorPendingRemoval] = useState<{
    doctorId: Id<'doctors'>;
    doctorName: string;
  } | null>(null);

  const doctors = useQuery(api.clinicMemberships.listMyClinicDoctors, {}) as MembershipCard[] | undefined;
  const requests = useQuery(api.clinicMemberships.listMyClinicRequests, {}) as MembershipCard[] | undefined;
  const invites = useQuery(api.clinicMemberships.listMyClinicInvites, {}) as MembershipCard[] | undefined;

  const {
    results: searchResults,
    isLoading: searchLoading,
  } = usePaginatedQuery(
    api.doctors.listPublic,
    {
      search: searchText.trim() || undefined,
    },
    { initialNumItems: 12 },
  );

  const inviteDoctor = useMutation(api.clinicMemberships.inviteDoctor);
  const acceptMembership = useMutation(api.clinicMemberships.accept);
  const rejectMembership = useMutation(api.clinicMemberships.reject);
  const cancelMembership = useMutation(api.clinicMemberships.cancel);
  const removeDoctor = useMutation(api.clinicMemberships.removeDoctor);

  const acceptedDoctorIds = useMemo(
    () => new Set((doctors ?? []).map((membership) => membership.doctorId)),
    [doctors],
  );
  const requestedDoctorIds = useMemo(
    () => new Set((requests ?? []).map((membership) => membership.doctorId)),
    [requests],
  );
  const invitedDoctorIds = useMemo(
    () => new Set((invites ?? []).map((membership) => membership.doctorId)),
    [invites],
  );

  const handleInviteDoctor = async (doctorId: Id<'doctors'>) => {
    try {
      setActiveInviteDoctorId(doctorId);
      await inviteDoctor({ doctorId });
    } catch (error) {
      Alert.alert('تعذر إرسال الدعوة', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setActiveInviteDoctorId(null);
    }
  };

  const handleAccept = async (membershipId: Id<'clinicMemberships'>) => {
    try {
      setActiveMembershipId(membershipId);
      await acceptMembership({ membershipId });
    } catch (error) {
      Alert.alert('تعذر قبول الطلب', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setActiveMembershipId(null);
    }
  };

  const handleReject = async (membershipId: Id<'clinicMemberships'>) => {
    try {
      setActiveMembershipId(membershipId);
      await rejectMembership({ membershipId });
    } catch (error) {
      Alert.alert('تعذر رفض الطلب', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setActiveMembershipId(null);
    }
  };

  const handleCancelInvite = async (membershipId: Id<'clinicMemberships'>) => {
    try {
      setActiveMembershipId(membershipId);
      await cancelMembership({ membershipId });
    } catch (error) {
      Alert.alert('تعذر إلغاء الدعوة', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setActiveMembershipId(null);
    }
  };

  const handleConfirmRemoveDoctor = async () => {
    if (!doctorPendingRemoval) return;

    try {
      setActiveInviteDoctorId(doctorPendingRemoval.doctorId);
      await removeDoctor({ doctorId: doctorPendingRemoval.doctorId });
      setDoctorPendingRemoval(null);
    } catch (error) {
      Alert.alert('تعذر إنهاء العضوية', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setActiveInviteDoctorId(null);
    }
  };

  const renderedSearchResults = (searchResults ?? []) as DoctorSearchCard[];
  const hasActiveSearch = searchText.trim().length > 0;

  return (
    <>
      <DoctorSection title="إدارة المختصين">
        <SearchBar
          value={searchText}
          onChangeText={setSearchText}
          placeholder="ابحث بالاسم أو التخصص"
          containerStyle={styles.searchBar}
        />

        {hasActiveSearch && searchLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : hasActiveSearch && renderedSearchResults.length > 0 ? (
          renderedSearchResults.map((doctor) => {
            const isAccepted = acceptedDoctorIds.has(doctor._id);
            const hasRequest = requestedDoctorIds.has(doctor._id);
            const hasInvite = invitedDoctorIds.has(doctor._id);

            return (
              <DoctorResultRow
                key={doctor._id}
                title={doctorDisplayName(doctor)}
                subtitle={doctor.specialty?.nameAr ?? 'بدون تخصص ظاهر'}
                meta={doctor.phone ?? undefined}
                badge={
                  isAccepted ? (
                    <Badge label="داخل المركز" tone="success" />
                  ) : hasRequest ? (
                    <Badge label="طلب وارد" tone="warning" />
                  ) : hasInvite ? (
                    <Badge label="دعوة معلقة" tone="info" />
                  ) : doctor.isAvailableToday ? (
                    <Badge label="متاح اليوم" tone="success" />
                  ) : undefined
                }
                actions={
                  isAccepted ? (
                    <Button
                      label="إنهاء العضوية"
                      variant="secondary"
                      icon="person-remove-outline"
                      loading={activeInviteDoctorId === doctor._id}
                      onPress={() =>
                        setDoctorPendingRemoval({
                          doctorId: doctor._id,
                          doctorName: doctorDisplayName(doctor),
                        })
                      }
                    />
                  ) : hasRequest || hasInvite ? null : (
                    <Button
                      label="إرسال دعوة"
                      icon="mail-open-outline"
                      loading={activeInviteDoctorId === doctor._id}
                      onPress={() => void handleInviteDoctor(doctor._id)}
                    />
                  )
                }
              />
            );
          })
        ) : hasActiveSearch ? (
          <Text style={styles.emptyText}>لا توجد نتائج مطابقة حالياً</Text>
        ) : null}
        <View style={styles.managementDivider} />

        <View style={styles.combinedSection}>
          <View style={styles.subsection}>
            <View style={styles.subsectionHeader}>
              <Text style={styles.subsectionTitle}>طلبات المختصين</Text>
              <Badge
                label={`${(requests ?? []).length}`}
                tone={(requests ?? []).length > 0 ? 'warning' : 'neutral'}
              />
            </View>
            {(requests ?? []).length > 0 ? (
              requests?.map((membership) => (
                <DoctorResultRow
                  key={membership._id}
                  title={membership.doctorName}
                  subtitle={membership.doctorPhone || 'يريد الانضمام إلى المركز'}
                  badge={<Badge label="بانتظار القرار" tone="warning" />}
                  actions={
                    <>
                      <Button
                        label="قبول"
                        icon="checkmark-circle-outline"
                        loading={activeMembershipId === membership._id}
                        onPress={() => void handleAccept(membership._id)}
                      />
                      <Button
                        label="رفض"
                        variant="secondary"
                        icon="close-circle-outline"
                        loading={activeMembershipId === membership._id}
                        onPress={() => void handleReject(membership._id)}
                      />
                    </>
                  }
                />
              ))
            ) : (
              <Text style={styles.emptyText}>لا توجد طلبات معلقة</Text>
            )}
          </View>

          <View style={styles.subsectionDivider} />

          <View style={styles.subsection}>
            <View style={styles.subsectionHeader}>
              <Text style={styles.subsectionTitle}>دعوات مرسلة</Text>
              <Badge
                label={`${(invites ?? []).length}`}
                tone={(invites ?? []).length > 0 ? 'info' : 'neutral'}
              />
            </View>
            {(invites ?? []).length > 0 ? (
              invites?.map((membership) => (
                <DoctorResultRow
                  key={membership._id}
                  title={membership.doctorName}
                  subtitle={membership.doctorPhone || 'بانتظار قبول المختص'}
                  badge={<Badge label="دعوة معلقة" tone="info" />}
                  actions={
                    <Button
                      label="إلغاء الدعوة"
                      variant="secondary"
                      icon="close-outline"
                      loading={activeMembershipId === membership._id}
                      onPress={() => void handleCancelInvite(membership._id)}
                    />
                  }
                />
              ))
            ) : (
              <Text style={styles.emptyText}>لا توجد دعوات معلقة</Text>
            )}
          </View>
        </View>
      </DoctorSection>

      <DoctorSection title="المختصون المقبولون">
        {(doctors ?? []).length > 0 ? (
          doctors?.map((membership) => (
            <DoctorResultRow
              key={membership._id}
              title={membership.doctorName}
              subtitle="عضو نشط ضمن مختصي المركز"
              meta={membership.doctorPhone || undefined}
              variant="member"
              badge={<Badge label="نشط" tone="success" />}
              actions={
                <Button
                  label="إنهاء العضوية"
                  variant="secondary"
                  icon="person-remove-outline"
                  style={styles.memberActionButton}
                  loading={activeInviteDoctorId === membership.doctorId}
                  onPress={() =>
                    setDoctorPendingRemoval({
                      doctorId: membership.doctorId,
                      doctorName: membership.doctorName,
                    })
                  }
                />
              }
            />
          ))
        ) : (
          <Text style={styles.emptyText}>لا يوجد مختصون داخل المركز حالياً</Text>
        )}
      </DoctorSection>

      <Modal
        visible={doctorPendingRemoval !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDoctorPendingRemoval(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDoctorPendingRemoval(null)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIcon}>
              <Ionicons name="person-remove-outline" size={22} color={theme.colors.danger} />
            </View>
            <Text style={styles.modalTitle}>تأكيد إنهاء العضوية</Text>
            <Text style={styles.modalMessage}>
              سيتم إنهاء عضوية {doctorPendingRemoval?.doctorName ?? 'هذا المختص'} وإلغاء
              المواعيد المستقبلية المرتبطة به داخل المركز.
            </Text>
            <View style={styles.modalActions}>
              <Button
                label="إلغاء"
                variant="secondary"
                style={styles.modalButton}
                onPress={() => setDoctorPendingRemoval(null)}
                disabled={activeInviteDoctorId !== null}
              />
              <Button
                label="تأكيد"
                style={styles.modalButton}
                loading={doctorPendingRemoval !== null && activeInviteDoctorId === doctorPendingRemoval.doctorId}
                onPress={() => void handleConfirmRemoveDoctor()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  loadingBox: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managementDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  rowPanel: {
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  combinedSection: {
    gap: theme.spacing.md,
  },
  subsection: {
    gap: theme.spacing.sm,
  },
  subsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  subsectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  subsectionDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  memberPanel: {
    backgroundColor: '#F4FBF7',
    borderColor: '#CFE6D7',
    padding: theme.spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  memberHeader: {
    alignItems: 'flex-start',
  },
  rowIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  memberAvatar: {
    backgroundColor: '#E6F4EC',
    borderColor: '#B8DEC8',
  },
  avatarText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  memberEyebrow: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.info,
    textAlign: 'right',
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: theme.spacing.sm,
  },
  memberTitleRow: {
    justifyContent: 'space-between',
  },
  memberBadgeInline: {
    flexShrink: 0,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  rowSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 3,
  },
  metaRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  memberMetaRow: {
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    backgroundColor: '#EAF4EF',
    borderWidth: 1,
    borderColor: '#D5E7DB',
  },
  rowMeta: {
    fontFamily: theme.typography.fontFamily.latin,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  actionsRowSingle: {
    width: '100%',
  },
  memberActionsRow: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#D5E7DB',
  },
  memberActionButton: {
    width: '100%',
    minHeight: 44,
    backgroundColor: '#FFFFFF',
    borderColor: '#BFD8C8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.status.danger.background,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  modalMessage: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  modalButton: {
    flex: 1,
  },
  emptyText: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
});
