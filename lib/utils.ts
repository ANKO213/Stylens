import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCleanStyleName(rawTitle: string) {
  // 1. Remove file extension
  let clean = rawTitle.replace(/\.[^/.]+$/, "");
  // 2. Remove date pattern (YYYY-MM-DD) and anything after it (e.g. -adk7r)
  clean = clean.replace(/-?\d{4}-\d{2}-\d{2}.*$/, "");
  // 3. Replace underscores with dashes (user preference)
  clean = clean.replace(/_/g, '-');
  return clean;
}

export function generateStyleDeepLink(prompt: string, title: string) {
  if (typeof window === 'undefined') return '';
  const cleanStyle = getCleanStyleName(title);
  return `${window.location.origin}/?action=generate&prompt=${encodeURIComponent(prompt)}&style=${encodeURIComponent(cleanStyle)}`;
}
