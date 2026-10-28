import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { createNetlifyHandler } from "../../server/netlify-store.mjs";

export default async function shop(request, context) {
  const origins = [
    context.site?.url,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.UNIPLAST_SITE_URL,
  ]
    .filter(Boolean)
    .map((url) => new URL(url).origin);
  return createNetlifyHandler({
    origins: [...new Set(origins)],
    setupKey: process.env.UNIPLAST_SETUP_KEY,
    getStores: () => {
      // Previews never read or modify the live shop's customers and orders.
      const prefix =
        context.deploy?.context === "production"
          ? "uniplast"
          : "uniplast-preview-" +
            createHash("sha256")
              .update(context.deploy?.id || "development")
              .digest("hex")
              .slice(0, 16);
      return {
        state: getStore({ name: prefix + "-state-v1", consistency: "strong" }),
        files: getStore({ name: prefix + "-files-v1", consistency: "strong" }),
      };
    },
  })(request, context);
}

export const config = { path: "/api/local/*" };
