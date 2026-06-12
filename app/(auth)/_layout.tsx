import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function AuthLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const me = useQuery(api.users.me, {});

  useEffect(() => {
    if (me?.role === "patient") {
      router.replace("/(patient)");
    } else if (me?.role === "doctor") {
      router.replace("/(doctor)/dashboard");
    } else if (me && pathname !== "/onboarding") {
      router.replace("/(auth)/onboarding");
    }
  }, [me, pathname, router]);

  if (me === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1A7BC4" />
      </View>
    );
  }

  if (me?.role === "patient" || me?.role === "doctor") {
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
