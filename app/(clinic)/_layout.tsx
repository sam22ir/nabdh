import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { theme } from "@/lib/theme";

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  dashboard: "grid",
  appointments: "calendar",
  schedule: "time",
  profile: "business",
  settings: "settings",
};

const ARABIC_LABELS: Record<string, string> = {
  dashboard: "لوحتي",
  appointments: "المواعيد",
  schedule: "الجدول",
  profile: "العيادة",
  settings: "الإعدادات",
};

export default function ClinicTabLayout() {
  const router = useRouter();
  const me = useQuery(api.users.me, {});

  useEffect(() => {
    if (me === null) {
      router.replace("/");
    } else if (me?.role === "patient") {
      router.replace("/(patient)");
    } else if (me?.role === "doctor") {
      router.replace("/(doctor)/dashboard");
    } else if (me && me.role !== "clinic") {
      router.replace("/");
    }
  }, [me, router]);

  if (me === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.official} />
      </View>
    );
  }

  if (!me || me.role !== "clinic") return null;

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = TAB_ICONS[route.name] ?? "ellipse";
            return (
              <Ionicons
                name={
                  focused
                    ? iconName
                    : (`${String(iconName)}-outline` as keyof typeof Ionicons.glyphMap)
                }
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
        <Tabs.Screen name="account-settings" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    writingDirection: "rtl",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
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
    textAlign: "right",
    writingDirection: "rtl",
  },
});
