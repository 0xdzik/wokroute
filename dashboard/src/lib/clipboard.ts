/** Clipboard helper — clipboard is undefined on insecure origins; never let that throw. */

export async function copyText(value: string): Promise<boolean> {
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
