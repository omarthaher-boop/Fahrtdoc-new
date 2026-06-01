import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Sets up isMedianApp global + exports the helper function (web-only, safe on native)
import "@/utils/median";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { useCarPlay } from "@/hooks/useCarPlay";
import { SubscriptionProvider, initializeRevenueCat } from "@/lib/revenuecat";

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== "web") {
  try {
    initializeRevenueCat();
  } catch (e) {
    console.warn("[RevenueCat] Init skipped:", e);
  }
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="(main)" />
    </Stack>
  );
}

/** Listens for notification taps and deep-links to the correct screen. */
function NotificationDeepLink() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.tripNotification) {
        router.push("/(main)/tracking");
      } else if (data?.watchdog || data?.driveDetectStopped) {
        router.push("/(main)/home");
      }
    });
    return () => sub.remove();
  }, [router]);
  return null;
}

/** Mounts the CarPlay / Android Auto bridge inside AppProvider. */
function CarPlayBridge({ children }: { children: React.ReactNode }) {
  useCarPlay();
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ThemeProvider>
              <AppProvider>
                <SubscriptionProvider>
                  <CarPlayBridge>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <NotificationDeepLink />
                        <RootLayoutNav />
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </CarPlayBridge>
                </SubscriptionProvider>
              </AppProvider>
            </ThemeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
