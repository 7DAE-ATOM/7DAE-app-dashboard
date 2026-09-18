"use client";

export default function Switch({
  checked,
  onChange,
  checkedClassName = "bg-accent",
  uncheckedClassName = "bg-border",
}: Readonly<{
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Track color when `checked` — defaults to the standard accent track. */
  checkedClassName?: string;
  /** Track color when not `checked` — defaults to the standard neutral track. */
  uncheckedClassName?: string;
}>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[20px] w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? checkedClassName : uncheckedClassName
      }`}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-surface shadow transition-transform"
        style={{ transform: checked ? "translateX(17px)" : "translateX(2px)" }}
      />
    </button>
  );
}
