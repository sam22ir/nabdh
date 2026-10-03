import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { theme } from '@/lib/theme';

/** Continuing with Google counts as accepting the terms and privacy policy. */
export default function LegalNotice() {
  const router = useRouter();
  return (
    <Text style={styles.text}>
      بمتابعتك فإنك توافق على{' '}
      <Text style={styles.link} onPress={() => router.push('/(auth)/terms-of-use')}>
        شروط الاستخدام
      </Text>{' '}
      و{' '}
      <Text style={styles.link} onPress={() => router.push('/(auth)/privacy-policy')}>
        سياسة الخصوصية
      </Text>
      .
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  link: { fontFamily: 'Cairo-Bold', color: theme.colors.primary },
});
