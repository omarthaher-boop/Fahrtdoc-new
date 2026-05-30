/**
 * ─────────────────────────────────────────────────────────────────
 * SUBSCRIPTION FEATURE FLAGS
 * ─────────────────────────────────────────────────────────────────
 *
 * SUBSCRIPTION_ENABLED = false  →  alle Paywall-Gates werden
 *   deaktiviert. Ideal zum Testen aller App-Funktionen.
 *
 * SUBSCRIPTION_ENABLED = true   →  Premium-Gates aktiv. Vor dem
 *   App Store Submit auf true setzen.
 *
 * ─────────────────────────────────────────────────────────────────
 * WAS DURCH DIESEN FLAG GESTEUERT WIRD
 * ─────────────────────────────────────────────────────────────────
 *
 * 1. FAHRTENHISTORIE (history.tsx)
 *    - Free-User sehen nur die letzten FREE_TRIP_LIMIT Fahrten
 *    - Ältere Fahrten sind ausgeblendet + Upgrade-Banner erscheint
 *
 * 2. EXPORT-GATES (history.tsx)
 *    - PDF Export   → gated für Free-User → öffnet PaywallModal
 *    - CSV Export   → gated für Free-User → öffnet PaywallModal
 *    - E-Mail Senden→ gated für Free-User → öffnet PaywallModal
 *
 * 3. PAYWALL MODAL (PaywallModal.tsx)
 *    - Wird von history.tsx und profile.tsx ausgelöst
 *    - Das Modal selbst bleibt immer aktiv (für den "Premium"-Button
 *      im Profil), aber wird für Export/Liste nur bei true getriggert
 *
 * ─────────────────────────────────────────────────────────────────
 * REAKTIVIEREN (vor App Store Submit)
 * ─────────────────────────────────────────────────────────────────
 *
 * 1. SUBSCRIPTION_ENABLED = true setzen (diese Datei)
 * 2. RevenueCat Dashboard: Produkte + Entitlements konfigurieren
 *    - Entitlement ID: "premium"
 *    - Offerings: "default" mit "monthly" + "annual" Packages
 * 3. Env-Vars prüfen:
 *    - EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
 *    - EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
 *    - EXPO_PUBLIC_REVENUECAT_TEST_API_KEY
 * 4. EAS Build triggern + TestFlight-Kauf testen
 * ─────────────────────────────────────────────────────────────────
 */

export const SUBSCRIPTION_ENABLED = false;

/** Max. Fahrten für Free-User in der Fahrtenhistorie */
export const FREE_TRIP_LIMIT = 5;
