import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { I18nManager, View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { theme } from "@/lib/theme";

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  dashboard: "grid",
  appointments: "calendar",
  schedule: "calendar",
  profile: "person",
  settings: "settings",
};

const ARABIC_LABELS: Record<string, string> = {
  dashboard: "لوحتي",
  appointments: "المواعيد",
  schedule: "الجدول",
  profile: "ملفي",
  settings: "الإعدادات",
};

export default function DoctorTabLayout() {
  const router = useRouter();
  const me = useQuery(api.users.me, {});

  // Enforce RTL layout
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  }, []);

  useEffect(() => {
    if (me === null) {
      router.replace("/(auth)/login");
    } else if (me?.role === "patient") {
      router.replace("/(patient)");
    } else if (me && me.role !== "doctor") {
      router.replace("/(auth)/onboarding");
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
      <Tabs.Screen name="appointments" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="settings" />
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
