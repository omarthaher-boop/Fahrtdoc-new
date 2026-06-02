import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useDriveTaskRunning } from "@/hooks/useDriveTaskRunning";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";

function TrackingDot() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.6,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <Animated.View
      style={[styles.trackingDot, { transform: [{ scale }] }]}
      accessibilityLabel="Fahrterfassung aktiv"
    />
  );
}

function TabIcon({
  isIOS,
  symbolName,
  featherName,
  color,
  tracking,
}: {
  isIOS: boolean;
  symbolName: SFSymbol;
  featherName: React.ComponentProps<typeof Feather>["name"];
  color: string;
  tracking: boolean;
}) {
  return (
    <View style={styles.iconWrapper}>
      {isIOS ? (
        <SymbolView name={symbolName} tintColor={color} size={24} />
      ) : (
        <Feather name={featherName} size={22} color={color} />
      )}
      {tracking && <TrackingDot />}
    </View>
  );
}

function ClassicMainTabs() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const { t } = useLanguage();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const driveTaskRunning = useDriveTaskRunning();
  const { activeTrip } = useApp();
  const tracking = driveTaskRunning || !!activeTrip;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : undefined,
        },
        tabBarItemStyle: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ color }) => (
            <TabIcon
              isIOS={isIOS}
              symbolName="house"
              featherName="home"
              color={color}
              tracking={tracking}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("nav.trips"),
          tabBarIcon: ({ color }) => (
            <TabIcon
              isIOS={isIOS}
              symbolName="list.bullet"
              featherName="list"
              color={color}
              tracking={tracking}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color }) => (
            <TabIcon
              isIOS={isIOS}
              symbolName="person"
              featherName="user"
              color={color}
              tracking={tracking}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  trackingDot: {
    position: "absolute",
    top: -2,
    right: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
});

export default function MainTabLayout() {
  const { user, loading } = useApp();

  if (loading) return null;

  if (!user) return <Redirect href="/" />;

  return <ClassicMainTabs />;
}
