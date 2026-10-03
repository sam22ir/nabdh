import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from '@/lib/backend';
import { api } from '@/lib/backend/api';
import { theme } from "@/lib/theme";

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home",
  search: "search",
  appointments: "calendar",
  favorites: "heart",
  profile: "person",
};

const ARABIC_LABELS: Record<string, string> = {
  index: "الرئيسية",
  search: "البحث",
  appointments: "مواعيدي",
  favorites: "المفضلة",
  profile: "حسابي",
};

export default function PatientTabLayout() {
  const router = useRouter();
  const me = useQuery(api.users.me, {});
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;

    if (me === null) {
      hasRedirected.current = true;
      router.replace("/");
    } else if (me?.role === "doctor") {
      hasRedirected.current = true;
      router.replace("/(doctor)/dashboard");
    } else if (me && me.role !== "patient") {
      hasRedirected.current = true;
      router.replace("/");
    }
  }, [me, router]);

  if (me === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.official} />
      </View>
    );
  }

  if (!me || me.role !== "patient") {
    return null;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = TAB_ICONS[route.name] ?? "ellipse";
          return (
            <Ionicons
              name={focused ? iconName : (`${String(iconName)}-outline` as keyof typeof Ionicons.glyphMap)}
              size={size}
              color={color}
            />
          );
        },
        tabBarLabel: ARABIC_LABELS[route.name] ?? route.name,
        tabBarActiveTintColor: theme.colors.official,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        headerShown: false,
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="appointments" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="account-settings" options={{ href: null }} />
      <Tabs.Screen name="doctor/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/clinic" options={{ href: null }} />
      <Tabs.Screen name="booking/profile" options={{ href: null }} />
      <Tabs.Screen name="booking/datetime" options={{ href: null }} />
      <Tabs.Screen name="booking/confirm" options={{ href: null }} />
      <Tabs.Screen name="booking/success" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 76,
    minHeight: 76,
    paddingTop: 6,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
  },
  tabBarItem: {
    paddingVertical: 2,
  },
  tabBarLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
});
