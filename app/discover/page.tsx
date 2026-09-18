import { Suspense } from "react";
import DiscoverClient from "@/components/DiscoverClient";

/** `DiscoverClient` reads `?ids=` (the catalogue's "Show in Discover" seed)
 * via `useSearchParams`, which needs a Suspense boundary under the static
 * export — same pattern as `app/application/page.tsx`. */
export default function DiscoverPage() {
  return (
    <Suspense>
      <DiscoverClient />
    </Suspense>
  );
}
