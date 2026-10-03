import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from '@/lib/backend';
import { api } from '@/lib/backend/api';
import { theme } from "@/lib/theme";

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  dashboard: "grid",
  appointments: "calendar",
  notes: "document-text",
  profile: "person",
  settings: "settings",
};

const ARABIC_LABELS: Record<string, string> = {
  dashboard: "لوحتي",
  appointments: "المواعيد",
  notes: "الملاحظات",
  profile: "ملفي",
  settings: "الإعدادات",
};

export default function DoctorTabLayout() {
  const router = useRouter();
  const me = useQuery(api.users.me, {});

  useEffect(() => {
    if (me === null) {
      router.replace("/");
    } else if (me?.role === "patient") {
      router.replace("/(patient)");
    } else if (me && me.role !== "doctor") {
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

  if (!me || me.role !== "doctor") {
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
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="notes" />
      <Tabs.Screen name="appointments" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="account-settings" options={{ href: null }} />
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
