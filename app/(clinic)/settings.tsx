import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@/lib/backend';
import { api } from '@/lib/backend/api';
import { DoctorHeader, DoctorSection } from '@/components/doctor-ui';
import { theme } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';

export default function ClinicSettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const clearUser = useAuthStore((state) => state.clearUser);
  const serverSettings = useQuery(api.clinicSettings.getMy, {});
  const updateSettings = useMutation(api.clinicSettings.updateMy);
  const me = useQuery(api.users.me, {});
  const setActiveMode = useMutation(api.users.setActiveMode);
  const [autoCompleteAppointments, setAutoCompleteAppointments] = useState(true);
  const [newBookingAlerts, setNewBookingAlerts] = useState(true);
  const [cancellationAlerts, setCancellationAlerts] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);

  useEffect(() => {
    if (serverSettings) {
      setAutoCompleteAppointments(serverSettings.autoCompleteAppointments);
      setNewBookingAlerts(serverSettings.newBookingAlerts);
      setCancellationAlerts(serverSettings.cancellationAlerts);
      setDailySummary(serverSettings.dailySummary);
    }
  }, [serverSettings]);

  const isLoading = serverSettings === undefined;

  const handleAutoToggle = async (value: boolean) => {
    setAutoCompleteAppointments(value);
    try {
      await updateSettings({ autoCompleteAppointments: value });
    } catch {
      setAutoCompleteAppointments((prev) => !prev);
    }
  };

  const handleToggleSetting = async (
    key: 'newBookingAlerts' | 'cancellationAlerts' | 'dailySummary',
    value: boolean,
  ) => {
    const rollback = {
      newBookingAlerts,
      cancellationAlerts,
      dailySummary,
    };

    if (key === 'newBookingAlerts') setNewBookingAlerts(value);
    if (key === 'cancellationAlerts') setCancellationAlerts(value);
    if (key === 'dailySummary') setDailySummary(value);

    try {
      await updateSettings({ [key]: value });
    } catch {
      setNewBookingAlerts(rollback.newBookingAlerts);
      setCancellationAlerts(rollback.cancellationAlerts);
      setDailySummary(rollback.dailySummary);
    }
  };

  const handleLogout = async () => {
    await signOut();
    clearUser();
    router.replace('/');
  };

  const autoDescription = useMemo(
    () =>
      autoCompleteAppointments
        ? 'عند نهاية مدة الموعد ينتقل تلقائياً إلى تم.'
        : 'يبقى الموعد داخل عند المختص حتى يغيّره موظف المركز يدوياً.',
    [autoCompleteAppointments],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <DoctorHeader title="إعدادات المركز" icon="settings-outline" centerTitle />

        <DoctorSection title="المواعيد">
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>الإكمال التلقائي</Text>
              <Text style={styles.settingDescription}>{autoDescription}</Text>
            </View>
            <Switch
              value={autoCompleteAppointments}
              onValueChange={(value) => void handleAutoToggle(value)}
              disabled={isLoading}
              trackColor={{ false: theme.colors.border, true: theme.colors.secondary }}
              thumbColor={autoCompleteAppointments ? theme.colors.primary : '#F4F3F4'}
            />
          </View>
        </DoctorSection>

        <DoctorSection title="التنبيهات">
          <View style={styles.settingsStack}>
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>تنبيهات الحجوزات الجديدة</Text>
                <Text style={styles.settingDescription}>
                  إشعار عند إنشاء موعد جديد داخل المركز.
                </Text>
              </View>
              <Switch
                value={newBookingAlerts}
                onValueChange={(value) => void handleToggleSetting('newBookingAlerts', value)}
                disabled={isLoading}
                trackColor={{ false: theme.colors.border, true: theme.colors.secondary }}
                thumbColor={newBookingAlerts ? theme.colors.primary : '#F4F3F4'}
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>تنبيهات الإلغاء</Text>
                <Text style={styles.settingDescription}>
                  إشعار عند إلغاء أحد المواعيد داخل المركز.
                </Text>
              </View>
              <Switch
                value={cancellationAlerts}
                onValueChange={(value) => void handleToggleSetting('cancellationAlerts', value)}
                disabled={isLoading}
                trackColor={{ false: theme.colors.border, true: theme.colors.secondary }}
                thumbColor={cancellationAlerts ? theme.colors.primary : '#F4F3F4'}
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>الملخص اليومي</Text>
                <Text style={styles.settingDescription}>
                  إرسال ملخص يومي لمواعيد المختص ضمن المركز.
                </Text>
              </View>
              <Switch
                value={dailySummary}
                onValueChange={(value) => void handleToggleSetting('dailySummary', value)}
                disabled={isLoading}
                trackColor={{ false: theme.colors.border, true: theme.colors.secondary }}
                thumbColor={dailySummary ? theme.colors.primary : '#F4F3F4'}
              />
            </View>
          </View>
        </DoctorSection>

        {me?.canSwitchRole ? (
          <DoctorSection title="التبديل بين الحسابين">
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void setActiveMode({ mode: 'doctor' }).then(() => router.replace('/'));
              }}
              style={styles.switchRow}
            >
              <Text style={styles.switchText}>التبديل إلى حساب المختص</Text>
            </Pressable>
          </DoctorSection>
        ) : null}

        <DoctorSection title="الحساب">
          <Pressable
            style={styles.accountButton}
            onPress={() => router.push('/(clinic)/account-settings')}
          >
            <Text style={styles.accountButtonText}>إعدادات الحساب</Text>
          </Pressable>
          <Pressable style={styles.logoutButton} onPress={() => void handleLogout()}>
            <Text style={styles.logoutText}>تسجيل الخروج</Text>
          </Pressable>
        </DoctorSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
  },
  switchText: {
    fontFamily: 'Cairo-Bold',
    color: theme.colors.primary,
    textAlign: 'right',
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  settingRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  settingsStack: {
    gap: theme.spacing.sm,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    fontSize: 15,
  },
  settingDescription: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  logoutButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  accountButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  accountButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
  },
  logoutText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.danger,
  },
});
