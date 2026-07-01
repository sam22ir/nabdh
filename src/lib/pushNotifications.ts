import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";

type RegisterPushNotificationsOptions = {
  convex: ConvexReactClient;
};

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

function canUseRemoteNotifications() {
  if (Platform.OS === "web") return false;

  // Expo Go on Android throws as soon as expo-notifications is imported in SDK
  // 53+. Push registration must be tested in a development build instead.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return false;
  }

  return true;
}

export async function registerPushNotifications({
  convex,
}: RegisterPushNotificationsOptions): Promise<string | null> {
  if (!canUseRemoteNotifications()) return null;

  const Notifications = await import("expo-notifications");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === "granted"
      ? existing
      : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return null;

  const projectId = getProjectId();
  const token = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  await convex.mutation(api.notifications.registerPushToken, {
    token: token.data,
    platform: Platform.OS === "ios" ? "ios" : "android",
  });

  return token.data;
}

export async function unregisterPushNotifications(
  convex: ConvexReactClient,
  token: string | null,
) {
  if (!token) return;
  await convex.mutation(api.notifications.unregisterPushToken, { token });
}
