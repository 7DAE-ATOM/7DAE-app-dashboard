import clsx from "clsx";

type Props = { size?: number; className?: string };

/**
 * Head-and-shoulders silhouette — the banner's profile trigger.
 *
 * Deliberately GENERIC: the same drawing before and after the identity
 * loads, never initials, so the banner does not change shape when
 * `/api/infos/me` answers. Decorative like every icon here: the meaning is
 * carried by the accessible label of the button that contains it.
 *
 * Used on: components/UserMenu.tsx
 */
export default function UserIcon({ size = 18, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx(className)}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}
