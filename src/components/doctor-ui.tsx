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
