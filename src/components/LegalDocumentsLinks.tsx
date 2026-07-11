import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

const documents = [
  {
    title: 'شروط الاستخدام',
    icon: 'document-text-outline' as const,
    href: '/(auth)/terms-of-use' as const,
  },
  {
    title: 'سياسة الخصوصية',
    icon: 'shield-checkmark-outline' as const,
    href: '/(auth)/privacy-policy' as const,
  },
];

export default function LegalDocumentsLinks() {
  const router = useRouter();

  return (
    <View style={styles.list}>
      {documents.map((document, index) => (
        <Pressable
          key={document.href}
          accessibilityRole="button"
          accessibilityLabel={document.title}
          onPress={() => router.push(document.href)}
          style={({ pressed }) => [
            styles.row,
            index > 0 && styles.rowDivider,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={styles.icon}>
            <Ionicons name={document.icon} size={18} color={theme.colors.official} />
          </View>
          <Text style={styles.title}>{document.title}</Text>
          <Ionicons name="chevron-back" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: theme.colors.white },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  rowPressed: { opacity: 0.72 },
  icon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.secondary,
  },
  title: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
