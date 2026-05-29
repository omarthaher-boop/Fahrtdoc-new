import { getUncachableRevenueCatClient } from "./revenueCatClient.js";

import {
  Duration,
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "FahrtDoc";

const MONTHLY_IDENTIFIER = "fahrtdoc_premium_monthly";
const YEARLY_IDENTIFIER = "fahrtdoc_premium_yearly";
const PLAY_STORE_MONTHLY_IDENTIFIER = "fahrtdoc_premium_monthly:monthly";
const PLAY_STORE_YEARLY_IDENTIFIER = "fahrtdoc_premium_yearly:yearly";

const APP_STORE_APP_NAME = "FahrtDoc iOS";
const APP_STORE_BUNDLE_ID = "app.replit.fahrtdoc";
const PLAY_STORE_APP_NAME = "FahrtDoc Android";
const PLAY_STORE_PACKAGE_NAME = "app.replit.fahrtdoc";

const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "Premium Access";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "FahrtDoc Premium";

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });

  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);

  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error: createProjectError } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (createProjectError) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  let testStoreApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testStoreApp) throw new Error("No test store app found");
  console.log("Test Store app found:", testStoreApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app found:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app found:", playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });

  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    identifier: string,
    duration: Duration,
    isTestStore: boolean
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) => p.store_identifier === identifier && p.app_id === targetApp.id
    );
    if (existing) {
      console.log(`${label} product already exists:`, existing.id);
      return existing;
    }
    const body: CreateProductData["body"] = {
      store_identifier: identifier,
      app_id: targetApp.id,
      type: "subscription",
      display_name: label,
    };
    if (isTestStore) {
      body.subscription = { duration };
      body.title = label;
    }
    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error(`Failed to create ${label} product`);
    console.log(`Created ${label} product:`, created.id);
    return created;
  };

  const [testMonthly, appMonthly, playMonthly] = await Promise.all([
    ensureProduct(testStoreApp, "Premium Monthly", MONTHLY_IDENTIFIER, Duration.P1M, true),
    ensureProduct(appStoreApp, "Premium Monthly", MONTHLY_IDENTIFIER, Duration.P1M, false),
    ensureProduct(playStoreApp, "Premium Monthly", PLAY_STORE_MONTHLY_IDENTIFIER, Duration.P1M, false),
  ]);

  const [testYearly, appYearly, playYearly] = await Promise.all([
    ensureProduct(testStoreApp, "Premium Yearly", YEARLY_IDENTIFIER, Duration.P1Y, true),
    ensureProduct(appStoreApp, "Premium Yearly", YEARLY_IDENTIFIER, Duration.P1Y, false),
    ensureProduct(playStoreApp, "Premium Yearly", PLAY_STORE_YEARLY_IDENTIFIER, Duration.P1Y, false),
  ]);

  const addTestPrice = async (product: Product, prices: { amount_micros: number; currency: string }[]) => {
    const { error } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: product.id },
      body: { prices },
    });
    if (error && typeof error === "object" && "type" in error && error["type"] === "resource_already_exists") {
      console.log("Test prices already exist for:", product.id);
    } else if (error) {
      console.warn("Failed to add test prices:", error);
    } else {
      console.log("Test prices added for:", product.id);
    }
  };

  await addTestPrice(testMonthly, [
    { amount_micros: 4990000, currency: "EUR" },
    { amount_micros: 4990000, currency: "USD" },
  ]);
  await addTestPrice(testYearly, [
    { amount_micros: 39990000, currency: "EUR" },
    { amount_micros: 39990000, currency: "USD" },
  ]);

  let entitlement: Entitlement | undefined;
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const existingEntitlement = existingEntitlements.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);
  if (existingEntitlement) {
    console.log("Entitlement already exists:", existingEntitlement.id);
    entitlement = existingEntitlement;
  } else {
    const { data: newEnt, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create entitlement");
    console.log("Created entitlement:", newEnt.id);
    entitlement = newEnt;
  }

  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: {
      product_ids: [testMonthly.id, testYearly.id, appMonthly.id, appYearly.id, playMonthly.id, playYearly.id],
    },
  });
  if (attachEntErr && attachEntErr.type !== "unprocessable_entity_error") {
    throw new Error("Failed to attach products to entitlement");
  }
  console.log("Products attached to entitlement");

  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOff, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOff.id);
    offering = newOff;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Offering set as current");
  }

  const { data: existingPkgs, error: listPkgsError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPkgsError) throw new Error("Failed to list packages");

  const ensurePackage = async (lookupKey: string, displayName: string): Promise<Package> => {
    const existing = existingPkgs.items?.find((p) => p.lookup_key === lookupKey);
    if (existing) {
      console.log(`Package ${lookupKey} already exists:`, existing.id);
      return existing;
    }
    const { data: newPkg, error } = await createPackages({
      client,
      path: { project_id: project.id, offering_id: offering!.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (error) throw new Error(`Failed to create package ${lookupKey}`);
    console.log(`Created package ${lookupKey}:`, newPkg.id);
    return newPkg;
  };

  const monthlyPkg = await ensurePackage("$rc_monthly", "Monthly Premium");
  const yearlyPkg = await ensurePackage("$rc_annual", "Yearly Premium");

  const attachPkg = async (pkg: Package, products: Product[]) => {
    const { error } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: products.map((p) => ({ product_id: p.id, eligibility_criteria: "all" as const })),
      },
    });
    if (error && error.type === "unprocessable_entity_error") {
      console.log("Package products already attached:", pkg.lookup_key);
    } else if (error) {
      throw new Error("Failed to attach products to package " + pkg.lookup_key);
    } else {
      console.log("Products attached to package:", pkg.lookup_key);
    }
  };

  await attachPkg(monthlyPkg, [testMonthly, appMonthly, playMonthly]);
  await attachPkg(yearlyPkg, [testYearly, appYearly, playYearly]);

  const getKeys = async (app: App) => {
    const { data, error } = await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: app.id },
    });
    if (error) return "N/A";
    return data?.items.map((k) => k.key).join(", ") ?? "N/A";
  };

  const [testKey, iosKey, androidKey] = await Promise.all([
    getKeys(testStoreApp),
    getKeys(appStoreApp),
    getKeys(playStoreApp),
  ]);

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log("Test Store App ID:", testStoreApp.id);
  console.log("App Store App ID:", appStoreApp.id);
  console.log("Play Store App ID:", playStoreApp.id);
  console.log("Entitlement:", ENTITLEMENT_IDENTIFIER);
  console.log("Public API Key - Test Store:", testKey);
  console.log("Public API Key - App Store:", iosKey);
  console.log("Public API Key - Play Store:", androidKey);
  console.log("====================");
  console.log("\nSet these env vars:");
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=" + testKey);
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=" + iosKey);
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=" + androidKey);
  console.log("REVENUECAT_PROJECT_ID=" + project.id);
}

seedRevenueCat().catch(console.error);
