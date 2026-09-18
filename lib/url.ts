/** Whether `value` is a non-empty, well-formed URL — used to decide whether
 * a document link should render as clickable or as plain/disabled text. */
export function isValidUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
