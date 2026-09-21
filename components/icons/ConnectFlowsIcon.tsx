import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Two rectangles a link comes to join — the Discover toolbar's "connect the
 * flows between the applications shown" action
 * (`DiscoverConnectFlowsButton`). The join is what the action adds; the boxes
 * were already there, which is the whole point of the command. */
export default function ConnectFlowsIcon({ size = 14, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx(className)}
    >
      <rect x="2" y="3" width="7" height="6" rx="1.5" />
      <rect x="15" y="15" width="7" height="6" rx="1.5" />
      <path d="M5.5 9v4.5a2 2 0 0 0 2 2h8" />
      <path d="M13 13.5 15.5 15.5 13 17.5" />
    </svg>
  );
}
