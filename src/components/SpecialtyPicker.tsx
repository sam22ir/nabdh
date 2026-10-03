import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Id } from '@/convex/_generated/dataModel';
import { specialtyDisplayName, type SpecialtyNameSource } from '@/lib/specialtyNames';
import { theme } from '@/lib/theme';

type SpecialtyOption = SpecialtyNameSource & {
  _id: Id<'specialties'>;
};

type SpecialtyPickerProps = {
  options: SpecialtyOption[];
  value: Id<'specialties'> | null;
  onChange: (value: Id<'specialties'>) => void;
  disabled?: boolean;
};

function normalizeArabic(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه');
}

export default function SpecialtyPicker({
  options,
  value,
  onChange,
  disabled = false,
}: SpecialtyPickerProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((specialty) => specialty._id === value);
  const filteredOptions = useMemo(() => {
    const query = normalizeArabic(search);
    if (!query) return options;
    return options.filter((specialty) =>
      normalizeArabic(specialtyDisplayName(specialty)).includes(query),
    );
  }, [options, search]);

  const close = () => {
    setVisible(false);
    setSearch('');
  };

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.triggerPressed,
          disabled && styles.triggerDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="اختيار التخصص"
      >
        <View style={styles.triggerIcon}>
          <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
        </View>
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? specialtyDisplayName(selected) : 'اختر التخصص'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="إغلاق قائمة التخصصات"
          />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>اختر التخصص</Text>
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="إغلاق">
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={19} color={theme.colors.textSecondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث عن التخصص"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.searchInput}
                textAlign="right"
                autoFocus
              />
            </View>
            <Text style={styles.resultCount}>{filteredOptions.length} تخصص</Text>
            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item._id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = item._id === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item._id);
                      close();
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      isSelected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={specialtyDisplayName(item)}
                  >
                    <View style={styles.optionIcon}>
                      <Ionicons name="person-outline" size={17} color={theme.colors.info} />
                    </View>
                    <Text style={styles.optionName}>{specialtyDisplayName(item)}</Text>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                    ) : (
                      <View style={styles.optionSpacer} />
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>لا يوجد تخصص مطابق</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
  },
  triggerPressed: { borderColor: theme.colors.focus, backgroundColor: theme.colors.white },
  triggerDisabled: { opacity: 0.55 },
  triggerIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
  },
  triggerText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  placeholder: { fontFamily: theme.typography.fontFamily.arabic, color: theme.colors.textSecondary },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay },
  sheet: {
    maxHeight: '82%',
    minHeight: '62%',
    backgroundColor: theme.colors.surfaceRaised,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    paddingBottom: theme.spacing['2xl'],
  },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.background,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  resultCount: {
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  listContent: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  optionSelected: { backgroundColor: theme.colors.secondary },
  optionPressed: { backgroundColor: theme.colors.surfaceMuted },
  optionIcon: {
    width: 30,
    height: 30,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  optionName: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  optionSpacer: { width: 20 },
  emptyText: {
    paddingVertical: theme.spacing['3xl'],
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
