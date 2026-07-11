import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

type Props = {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  onTermsChange: (value: boolean) => void;
  onPrivacyChange: (value: boolean) => void;
};

function ConsentRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        hitSlop={6}
        onPress={() => onChange(!checked)}
        style={[styles.checkbox, checked && styles.checkboxChecked]}
      >
        {checked ? <Ionicons name="checkmark" size={18} color={theme.colors.white} /> : null}
      </Pressable>
      <View style={styles.label}>{children}</View>
    </View>
  );
}

export default function LegalConsent({
  termsAccepted,
  privacyAccepted,
  onTermsChange,
  onPrivacyChange,
}: Props) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ConsentRow checked={termsAccepted} onChange={onTermsChange}>
        <Text style={styles.text}>أوافق على </Text>
        <Text style={styles.link} onPress={() => router.push('/(auth)/terms-of-use')}>
          شروط الاستخدام وقواعد الحجز والإلغاء
        </Text>
      </ConsentRow>
      <ConsentRow checked={privacyAccepted} onChange={onPrivacyChange}>
        <Text style={styles.text}>أقر بأنني قرأت </Text>
        <Text style={styles.link} onPress={() => router.push('/(auth)/privacy-policy')}>
          سياسة الخصوصية
        </Text>
      </ConsentRow>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.md },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  checkbox: {
    width: 26,
    height: 26,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceRaised,
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  label: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  text: {
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    lineHeight: 24,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  link: {
    fontFamily: 'Cairo-Bold',
    fontSize: 13,
    lineHeight: 24,
    color: theme.colors.primary,
    textAlign: 'right',
  },
});
