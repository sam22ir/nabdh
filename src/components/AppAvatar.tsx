import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { theme } from '../lib/theme';

export default function AppAvatar({
  name,
  size = 44,
}: {
  name?: string | null;
  size?: number;
}) {
  return (
    <View
      accessibilityLabel={name ? `صورة ${name}` : 'صورة شخصية'}
      style={[styles.avatar, { width: size, height: size, borderRadius: Math.round(size * 0.26) }]}
    >
      <Ionicons name="person-outline" size={Math.round(size * 0.5)} color={theme.colors.official} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.status.info.border,
  },
});
