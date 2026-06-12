import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function AuthLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const me = useQuery(api.users.me, {});
  const patientRegistrationComplete = me?.role === "patient" && me.profile;
  const needsPatientProfile = me?.role === "patient" && !me.profile;

  useEffect(() => {
    if (patientRegistrationComplete) {
      router.replace("/(patient)");
    } else if (me?.role === "doctor") {
      router.replace("/(doctor)/dashboard");
    } else if (me && !needsPatientProfile && pathname !== "/onboarding") {
      router.replace("/(auth)/onboarding");
    }
  }, [me, needsPatientProfile, patientRegistrationComplete, pathname, router]);

  if (me === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1A7BC4" />
      </View>
    );
  }

  if (patientRegistrationComplete || me?.role === "doctor") {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
