import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

declare const process: {
  env: Record<string, string | undefined>;
};

function normalizeBasePath(basePath: string) {
  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;

  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function getBasePath(mode: string) {
  if (mode !== "production") {
    return "/";
  }

  if (process.env.BASE_PATH) {
    return normalizeBasePath(process.env.BASE_PATH);
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1);

  return repositoryName ? `/${repositoryName}/` : "/";
}

export default defineConfig(({ mode }) => ({
  base: getBasePath(mode),
  plugins: mode === "https" ? [react(), basicSsl()] : [react()],
  server: {
    host: "0.0.0.0",
  },
}));
