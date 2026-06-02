import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

/**
 * true when running in Expo Go (storeClient) or web.
 * react-native-purchases is a native module — it crashes in Expo Go.
 * We skip all RC calls in this mode.
 */
function isExpoGoOrWeb(): boolean {
  return (
    Platform.OS === "web" ||
    Constants.executionEnvironment === "storeClient"
  );
}

function getRevenueCatApiKey(): string {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error("RevenueCat API Keys nicht gefunden");
  }

  if (__DEV__) {
    return REVENUECAT_TEST_API_KEY;
  }

  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;

  return REVENUECAT_TEST_API_KEY;
}

export function initializeRevenueCat() {
  if (isExpoGoOrWeb()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Purchases = require("react-native-purchases").default;
    const apiKey = getRevenueCatApiKey();
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey });
  } catch (e) {
    console.warn("[RevenueCat] init failed:", e);
  }
}

function noop() {
  return Promise.resolve(undefined as any);
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();
  const skip = isExpoGoOrWeb();

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => {
      if (skip) return null;
      const Purchases = require("react-native-purchases").default;
      return Purchases.getCustomerInfo();
    },
    staleTime: 60 * 1000,
    enabled: !skip,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      if (skip) return null;
      const Purchases = require("react-native-purchases").default;
      return Purchases.getOfferings();
    },
    staleTime: 300 * 1000,
    enabled: !skip,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: any) => {
      if (skip) return null;
      const Purchases = require("react-native-purchases").default;
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["revenuecat", "customer-info"] }),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (skip) return null;
      const Purchases = require("react-native-purchases").default;
      return Purchases.restorePurchases();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["revenuecat", "customer-info"] }),
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  return {
    customerInfo: customerInfoQuery.data ?? null,
    offerings: offeringsQuery.data ?? null,
    isSubscribed,
    isLoading: !skip && (customerInfoQuery.isLoading || offeringsQuery.isLoading),
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
