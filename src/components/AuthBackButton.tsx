import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { theme } from '@/lib/theme';

export default function AuthBackButton() {
  const router = useRouter();

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={() => router.replace('/')}
        accessibilityRole="button"
        accessibilityLabel="العودة لاختيار نوع الحساب"
        hitSlop={8}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Ionicons name="arrow-forward" size={18} color={theme.colors.official} />
        <Text style={styles.label}>العودة</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    minHeight: 68,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'flex-end',
    backgroundColor: theme.colors.background,
    zIndex: 1,
  },
  button: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.official,
  },
});
