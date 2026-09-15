"use client";

import { useEffect, useRef, useState } from "react";
import CloseIcon from "@/components/icons/CloseIcon";
import {
  NEXT_PUBLIC_ATOM_API_BASE_URL,
  BASE_URL_FROM_ENV,
} from "@/lib/atom-api";

type Row = { label: string; value: string; warn?: boolean };

type ProbeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; code: number; ms: number }
  | { status: "error"; message: string; ms: number };

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
const GIT_COMMIT = process.env.NEXT_PUBLIC_GIT_COMMIT ?? "unknown";
const GIT_BRANCH = process.env.NEXT_PUBLIC_GIT_BRANCH ?? "unknown";
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? "unknown";
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "unknown";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_HREF || "(root)";
const AUTH_MODE = process.env.NEXT_PUBLIC_DEV_JWT
  ? "Bearer (dev JWT)"
  : "none (gateway-injected in prod)";

export default function AboutDialog() {
  const [open, setOpen] = useState(false);
  const [probe, setProbe] = useState<ProbeState>({ status: "idle" });
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const rows: Row[] = [
    { label: "Version", value: APP_VERSION },
    { label: "Commit", value: GIT_COMMIT },
    { label: "Branch", value: GIT_BRANCH },
    { label: "Build time", value: formatBuildTime(BUILD_TIME) },
    { label: "Environment", value: APP_ENV },
    { label: "Base path", value: BASE_PATH },
    {
      label: "Backend API URL",
      value: BASE_URL_FROM_ENV
        ? NEXT_PUBLIC_ATOM_API_BASE_URL
        : `${NEXT_PUBLIC_ATOM_API_BASE_URL}  ⚠ fallback (not set at build)`,
      warn: !BASE_URL_FROM_ENV,
    },
    { label: "Auth header", value: AUTH_MODE },
  ];

  const copyText = rows.map((r) => `${r.label}: ${r.value}`).join("\n");

  async function testBackend() {
    setProbe({ status: "loading" });
    const url = `${NEXT_PUBLIC_ATOM_API_BASE_URL}/api/infos/applications`;
    const started = performance.now();
    const devJwt = process.env.NEXT_PUBLIC_DEV_JWT;
    try {
      const res = await fetch(url, {
        headers: devJwt ? { Authorization: `Bearer ${devJwt}` } : undefined,
      });
      const ms = Math.round(performance.now() - started);
      if (res.ok) setProbe({ status: "ok", code: res.status, ms });
      else
        setProbe({
          status: "error",
          message: `HTTP ${res.status} ${res.statusText}`,
          ms,
        });
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      const e = err as { name?: string; message?: string };
      setProbe({
        status: "error",
        message: `${e?.name ?? "Error"}: ${e?.message ?? String(err)}`,
        ms,
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About this application"
        title="About / version & configuration"
        className="inline-flex items-center justify-center w-9 h-9 rounded text-muted hover:text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
      >
        <InfoIcon />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 id="about-title" className="text-base font-semibold">
                About — Applications Dashboard
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex items-center justify-center w-8 h-8 rounded text-muted hover:text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <CloseIcon />
              </button>
            </div>

            <dl className="divide-y divide-border text-sm">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="grid grid-cols-[8rem_1fr] gap-3 px-5 py-2.5"
                >
                  <dt className="text-muted">{r.label}</dt>
                  <dd
                    className={`font-mono break-all ${r.warn ? "text-danger" : ""}`}
                  >
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="px-5 py-3 border-t border-border">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={testBackend}
                  disabled={probe.status === "loading"}
                  className="px-4 py-2 rounded bg-accent text-accent-fg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {probe.status === "loading"
                    ? "Testing…"
                    : "Test backend connection"}
                </button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(copyText)}
                  className="px-4 py-2 rounded border border-border text-sm font-semibold hover:bg-surface-2 transition-colors"
                >
                  Copy
                </button>
              </div>
              {probe.status !== "idle" && probe.status !== "loading" && (
                <p
                  className={`mt-3 text-sm font-mono ${probe.status === "ok" ? "text-success" : "text-danger"}`}
                >
                  {probe.status === "ok"
                    ? `✓ ${probe.code} OK — ${probe.ms} ms`
                    : `✗ ${probe.message} — ${probe.ms} ms`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** ISO → readable UTC, tolerant of the "unknown" fallback. */
function formatBuildTime(iso: string): string {
  if (!iso || iso === "unknown") return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")}`;
}

function InfoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
