import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";

function NativeMainTabs() {
  const { t } = useLanguage();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>{t("nav.home")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet" }} />
        <Label>{t("nav.trips")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>{t("nav.profile")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicMainTabs() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const { t } = useLanguage();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.success,
        tabBarInactiveTintColor: "rgba(255,255,255,0.5)",
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.primary,
          borderTopWidth: 0,
          elevation: 0,
          height: isWeb ? 84 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={95}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("nav.trips"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="list.bullet" tintColor={color} size={24} />
            ) : (
              <Feather name="list" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={24} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function MainTabLayout() {
  const { user, loading } = useApp();

  if (loading) return null;

  if (!user) return <Redirect href="/" />;

  if (isLiquidGlassAvailable()) {
    return <NativeMainTabs />;
  }
  return <ClassicMainTabs />;
}
