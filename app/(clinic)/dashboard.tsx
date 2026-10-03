import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { DoctorHeader, MetricStrip } from '@/components/doctor-ui';
import { theme } from '@/lib/theme';

export default function ClinicDashboardScreen() {
  const availableToday = useQuery(api.bookings.countMyClinicDoctorsAvailableToday, {});
  const bookedAppointments = useQuery(api.bookings.countMyClinicBookedAppointments, {});
  const availableDoctorCount = availableToday?.count ?? 0;
  const bookedAppointmentsCount = bookedAppointments?.count ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <DoctorHeader title="لوحة المركز" icon="business-outline" centerTitle />
        <MetricStrip
          items={[
            {
              label: 'المختصون المتاحون للحجز اليوم',
              value: availableDoctorCount,
              icon: 'people-outline',
              tone: availableDoctorCount > 0 ? 'info' : 'neutral',
            },
            {
              label: 'إجمالي المواعيد المحجوزة',
              value: bookedAppointmentsCount,
              icon: 'calendar-outline',
              tone: bookedAppointmentsCount > 0 ? 'success' : 'neutral',
            },
          ]}
        />
      </ScrollView>
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
});
