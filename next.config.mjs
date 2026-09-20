import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

/** Run a git command, returning `fallback` if git is unavailable (e.g. the
 * Docker build stage only ships `out/`, never `.git`). */
function git(cmd, fallback) {
  try {
    return (
      execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim() || fallback
    );
  } catch {
    return fallback;
  }
}

// Build-time metadata, surfaced in the in-app "About" dialog so anyone can
// verify WHICH build is deployed without shell access. Jenkins exposes
// GIT_COMMIT / GIT_BRANCH; locally we fall back to the git CLI.
const gitCommit = (process.env.GIT_COMMIT || git("git rev-parse HEAD", "")).slice(
  0,
  7,
) || "unknown";
const gitBranch =
  (process.env.GIT_BRANCH || process.env.BRANCH_NAME || "")
    .replace(/^origin\//, "") ||
  git("git rev-parse --abbrev-ref HEAD", "unknown");
const buildTime = new Date().toISOString();

const nextConfig = {
  reactStrictMode: true,
  // Static export (for nginx) only on production builds. `next build` always
  // sets NODE_ENV=production, so Jenkins / `npm run build` still produce `out/`.
  // In dev we keep the full Next.js server.
  output: isProd ? "export" : undefined,
  // trailingSlash makes every generated link and exported page use the
  // slash-terminated form (`/atom-app-dashboard/`, `/atom-app-dashboard/map/`).
  // Behind the AFTER gateway, the bare basePath (`/atom-app-dashboard`, no slash)
  // triggers an upstream directory redirect that wrongly carries the backend port
  // (`https://host:8080/…`) and fails; the slash form works. Forcing the slash
  // means the logo/nav and any reload land on the working URL.
  // Safe here (it was removed earlier only because it forced a slash onto the now
  // -deleted backend proxy/rewrite): it affects ONLY Next page routes and <Link>,
  // never the hand-built API calls in lib/atom-api.ts.
  trailingSlash: true,
  // basePath/assetPrefix come from BASE_HREF, set by Jenkins for prod only.
  basePath: process.env.BASE_HREF || "",
  assetPrefix: process.env.BASE_HREF || "",
  // Inlined into the client bundle at build time (the App is a static export,
  // so there is no runtime to read these later). Consumed by `AboutDialog`.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
    NEXT_PUBLIC_GIT_BRANCH: gitBranch,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || (isProd ? "prod" : "dev"),
  },
};

export default nextConfig;
