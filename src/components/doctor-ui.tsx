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
  titleContent?: React.ReactNode;
  subtitle?: string;
  eyebrow?: string;
  icon?: IconName | null;
  iconPosition?: 'start' | 'end';
  action?: React.ReactNode;
  centerTitle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function DoctorHeader({
  title,
  titleContent,
  subtitle,
  eyebrow,
  icon = 'calendar-outline',
  iconPosition = 'start',
  action,
  centerTitle,
  style,
}: DoctorHeaderProps) {
  const shouldCenterTitle = centerTitle ?? (!icon && !action);

  return (
    <View style={[styles.header, shouldCenterTitle && styles.headerCentered, style]}>
      <View style={[styles.headerText, shouldCenterTitle && styles.headerTextCentered]}>
        {eyebrow ? <Text style={styles.headerEyebrow}>{eyebrow}</Text> : null}
        <View
          style={[
            styles.headerTitleRow,
            shouldCenterTitle && styles.headerTitleRowCentered,
          ]}
        >
          {icon ? (
            <View
              style={[
                styles.headerIcon,
                shouldCenterTitle &&
                  iconPosition === 'end' &&
                  styles.headerIconCenteredEnd,
              ]}
            >
              <Ionicons name={icon} size={19} color={theme.colors.white} />
            </View>
          ) : null}
          <View
            style={[
              styles.headerTitleContent,
              shouldCenterTitle && styles.headerTitleContentCentered,
            ]}
          >
            {titleContent ?? (
              <Text
                style={[
                  styles.headerTitle,
                  shouldCenterTitle && styles.headerTitleCentered,
                ]}
                numberOfLines={2}
              >
                {title}
              </Text>
            )}
          </View>
        </View>
        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
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
  progressValue?: number;
}

interface MetricStripProps {
  items: MetricItem[];
  columns?: 2 | 4;
}

export function MetricStrip({ items, columns = 4 }: MetricStripProps) {
  return (
    <View
      style={[
        styles.metricStrip,
        columns === 2 && styles.metricStripTwoColumns,
      ]}
    >
      {items.map((item, index) => {
        const tone = item.tone ?? 'neutral';
        const palette = theme.colors.status[tone];
        const hasProgress = typeof item.progressValue === 'number';
        const progressValue = hasProgress
          ? Math.min(100, Math.max(0, item.progressValue ?? 0))
          : 0;
        const progressTone = getMetricProgressTone(progressValue);
        const progressPalette = theme.colors.status[progressTone];

        return (
          <View
            key={`${item.label}-${item.value}`}
            style={[
              styles.metricCard,
              columns === 2 && styles.metricCardHalf,
              columns === 2 && index < 2 && styles.metricCardGridTop,
              columns === 2 && index % 2 === 0 && styles.metricCardGridEnd,
            ]}
          >
            <View style={styles.metricHeaderRow}>
              <View style={[styles.metricIcon, { backgroundColor: palette.background }]}>
                <Ionicons name={item.icon} size={15} color={palette.text} />
              </View>
              <Text style={styles.metricLabel} numberOfLines={2}>
                {item.label}
              </Text>
            </View>

            <View style={hasProgress ? styles.metricProgressRow : styles.metricValueRow}>
              <Text
                style={[
                  styles.metricValue,
                  columns === 2 && styles.metricValueGrid,
                ]}
                numberOfLines={1}
              >
                {item.value}
              </Text>
              {hasProgress ? (
                <View
                  style={[
                    styles.metricProgressTrack,
                    { backgroundColor: progressPalette.background },
                  ]}
                >
                  <View
                    style={[
                      styles.metricProgressFill,
                      {
                        backgroundColor: progressPalette.text,
                        width: `${progressValue}%`,
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function getMetricProgressTone(value: number): BadgeTone {
  if (value <= 20) {
    return 'danger';
  }
  if (value < 80) {
    return 'warning';
  }
  return 'success';
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
  showIcon?: boolean;
  onPress?: () => void;
}

export function AppointmentWorkItem({
  time,
  patientName,
  meta,
  statusLabel,
  tone = 'neutral',
  icon = 'person-outline',
  showIcon = true,
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
          {showIcon && (
            <Ionicons name={icon} size={15} color={theme.colors.primary} />
          )}
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
  title?: string;
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
  const hasHeader = Boolean(title || subtitle || action);

  return (
    <View style={[styles.section, style]}>
      {hasHeader ? (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionText}>
            {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
            {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
          </View>
          {action ? <View>{action}</View> : null}
        </View>
      ) : null}
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
  headerCentered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTextCentered: {
    alignItems: 'center',
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
    minWidth: 0,
  },
  headerTitleRowCentered: {
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContent: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleContentCentered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconCenteredEnd: {
    position: 'absolute',
    end: 0,
  },
  headerTitle: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    lineHeight: 30,
    color: theme.colors.white,
    textAlign: rtlTextAlign(),
  },
  headerTitleCentered: {
    alignSelf: 'center',
    textAlign: 'center',
    width: '100%',
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
  metricStripTwoColumns: {
    flexWrap: 'wrap',
    gap: 0,
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: 0,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    overflow: 'hidden',
  },
  metricCard: {
    flex: 1,
    minHeight: 96,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  metricCardHalf: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '50%',
    minHeight: 88,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    padding: theme.spacing.md,
  },
  metricCardGridTop: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  metricCardGridEnd: {
    borderEndWidth: StyleSheet.hairlineWidth,
    borderEndColor: theme.colors.border,
  },
  metricHeaderRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
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
    fontSize: 18,
    color: theme.colors.official,
    textAlign: 'right',
  },
  metricValueGrid: {
    fontSize: 22,
    lineHeight: 28,
  },
  metricLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metricValueRow: {
    alignItems: 'flex-end',
  },
  metricProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  metricProgressTrack: {
    flex: 1,
    height: 5,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    alignItems: 'flex-end',
  },
  metricProgressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
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
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    width: '100%',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    writingDirection: 'rtl',
  },
  sectionText: {
    flex: 1,
    flexShrink: 1,
    alignSelf: 'stretch',
    minWidth: 0,
    maxWidth: '100%',
    width: '100%',
    alignItems: 'flex-end',
    writingDirection: 'rtl',
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    width: '100%',
    alignSelf: 'stretch',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionSubtitle: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    width: '100%',
    alignSelf: 'stretch',
    textAlign: 'right',
    writingDirection: 'rtl',
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
