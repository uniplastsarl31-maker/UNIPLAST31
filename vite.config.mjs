import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_"),
    key = env.VITE_SUPABASE_ANON_KEY || "";
  let role = "";
  try {
    role = JSON.parse(
      Buffer.from(key.split(".")[1] || "", "base64url").toString(),
    ).role;
  } catch {}
  if (key.startsWith("sb_secret_") || role === "service_role")
    throw new Error(
      "Never put a secret or service_role key in VITE_SUPABASE_ANON_KEY. Use a publishable/anon key.",
    );
  return {
    define: {
      __LOCAL_BUILD__: JSON.stringify(mode !== "web"),
      __NETLIFY_BUILD__: JSON.stringify(mode === "netlify"),
      __PREVIEW_BUILD__: JSON.stringify(
        mode === "web" &&
          (!env.VITE_SUPABASE_URL?.trim() ||
            !key.trim() ||
            env.VITE_PREVIEW_MODE === "true"),
      ),
    },
    plugins: [react()],
    build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
