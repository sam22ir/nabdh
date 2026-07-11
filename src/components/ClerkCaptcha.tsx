import { Platform, StyleSheet, View } from 'react-native';

export default function ClerkCaptcha() {
  if (Platform.OS !== 'web') return null;

  return <View nativeID="clerk-captcha" style={styles.captcha} />;
}

const styles = StyleSheet.create({
  captcha: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
