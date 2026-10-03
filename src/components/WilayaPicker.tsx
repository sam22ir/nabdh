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

import type { Id } from '@/lib/backend/types';
import { theme } from '@/lib/theme';

type WilayaOption = {
  _id: Id<'wilayas'>;
  id: number;
  name: string;
};

type WilayaPickerProps = {
  options: WilayaOption[];
  value: Id<'wilayas'> | null;
  onChange: (value: Id<'wilayas'>) => void;
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

export default function WilayaPicker({
  options,
  value,
  onChange,
  disabled = false,
}: WilayaPickerProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((wilaya) => wilaya._id === value);
  const filteredOptions = useMemo(() => {
    const query = normalizeArabic(search);
    if (!query) return options;
    return options.filter((wilaya) =>
      normalizeArabic(`${wilaya.id} ${wilaya.name}`).includes(query),
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
        accessibilityLabel="اختيار الولاية"
      >
        <View style={styles.triggerIcon}>
          <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
        </View>
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? `${selected.id} - ${selected.name}` : 'اختر الولاية'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="إغلاق قائمة الولايات"
          />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>اختر الولاية</Text>
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="إغلاق">
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={19} color={theme.colors.textSecondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث باسم الولاية أو رقمها"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.searchInput}
                textAlign="right"
                autoFocus
              />
            </View>
            <Text style={styles.resultCount}>{filteredOptions.length} ولاية</Text>
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
                    accessibilityLabel={`${item.id} ${item.name}`}
                  >
                    <Text style={styles.optionNumber}>{item.id}</Text>
                    <Text style={styles.optionName}>{item.name}</Text>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                    ) : (
                      <View style={styles.optionSpacer} />
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>لا توجد ولاية مطابقة</Text>}
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
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
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
  optionNumber: {
    width: 30,
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
