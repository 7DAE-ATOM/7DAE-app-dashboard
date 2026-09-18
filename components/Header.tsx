"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import ThemeToggle from "./ThemeToggle";
import AboutDialog from "./AboutDialog";
import RefreshButton from "./RefreshButton";
import PhotoCacheSettingsControl from "./PhotoCacheSettingsControl";

export default function Header() {
  // usePathname() is typed `string | null` in some Next versions (e.g. 16.2.9)
  // and `string` in others (16.2.7) — coalesce so the strict null check passes
  // regardless of the installed patch.
  const pathname = usePathname() ?? "";
  const [logoFailed, setLogoFailed] = useState(false);

  const catalogueActive =
    pathname === "/" || pathname.startsWith("/application");
  const mapActive =
    pathname === "/map" || pathname.startsWith("/map/");
  const discoverActive =
    pathname === "/discover" || pathname.startsWith("/discover/");

  const itemClass = (active: boolean) =>
    clsx(
      "px-3 py-1.5 rounded text-sm font-medium transition-colors",
      active
        ? "bg-[#00205B] text-white"
        : "text-[#00205B]/70 hover:text-[#00205B]"
    );

  return (
    <header className="sticky top-0 z-20 border-b border-[#00205B]/15 bg-white">
      <div className="relative px-4 md:px-6 py-3 flex items-center gap-6">
        <Link
          href="/"
          className="flex flex-col items-start justify-center hover:opacity-80 transition-opacity"
          aria-label="Airbus — go to catalogue"
        >
          {logoFailed ? (
            <span className="text-lg font-bold tracking-tight">Airbus</span>
          ) : (
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_HREF ?? ""}/airbus-logo.svg`}
              alt="Airbus"
              className="h-6 w-auto"
              onError={() => setLogoFailed(true)}
            />
          )}
          <span className="text-[10px] leading-tight tracking-wide whitespace-nowrap">
            <span className="font-bold text-[#00205B]">Applications</span>{" "}
            <span className="font-semibold text-[#00205B]/55">Board</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/" className={itemClass(catalogueActive)}>
            Catalogue
          </Link>
          <Link href="/map" className={itemClass(mapActive)}>
            Map
          </Link>
          <Link href="/discover" className={itemClass(discoverActive)}>
            Discover
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 min-h-[32px]">
          {/* RESERVED: avatar, global search, notifications (V2) */}
          <RefreshButton />
          <PhotoCacheSettingsControl />
          <AboutDialog />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
