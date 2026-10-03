import { Stack } from 'expo-router';

// Only the legal documents live here now; sign-in is the welcome screen.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="terms-of-use" />
      <Stack.Screen name="privacy-policy" />
    </Stack>
  );
}
