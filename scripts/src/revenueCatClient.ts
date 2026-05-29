import { ReplitConnectors } from "@replit/connectors-sdk";
import { createClient, createConfig } from "@replit/revenuecat-sdk/client";

export async function getUncachableRevenueCatClient() {
  const connectors = new ReplitConnectors();

  const client = createClient(
    createConfig({
      baseUrl: "https://api.revenuecat.com",
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        // SDK omits /v2 prefix — prepend it
        let path = url.pathname + url.search;
        if (!path.startsWith("/v2")) {
          path = "/v2" + path;
        }

        const method = request.method;
        let body: unknown;
        if (method !== "GET" && method !== "HEAD") {
          const text = await request.text();
          if (text) {
            try { body = JSON.parse(text); } catch { body = text; }
          }
        }

        const proxyResponse = await connectors.proxy("revenuecat", path, {
          method,
          ...(body !== undefined ? { body } : {}),
        });

        const text = await proxyResponse.text();
        return new Response(text, {
          status: proxyResponse.status,
          headers: { "content-type": "application/json" },
        });
      },
    })
  );

  return client;
}
