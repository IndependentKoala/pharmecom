import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { API_BASE } from '@/lib/api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper to get image src from either API (snake_case) or local (camelCase) fields
export function getImageSrc(p: any): string | undefined {
  // Prefer explicit `image_url` (may be absolute or relative) over `image`.
  const raw = p?.image_url || p?.image || p?.imageUrl;
  if (!raw) return undefined;
  // If backend returned an absolute URL pointing to localhost backend (e.g. http://127.0.0.1:8000/...),
  // convert it to a site-relative path so the dev server or backend static serve can handle it.
  try {
    const url = new URL(raw);
    // If it's a placeholder served by the frontend public folder, prefer frontend path
    if (url.pathname === '/placeholder.svg') return '/placeholder.svg';
    // If it's a data URL, return as-is
    if (raw.startsWith('data:')) return raw;
    // Return absolute URL unchanged — browsers can load images cross-origin.
    return raw;
  } catch (e) {
    // Not an absolute URL — likely a site-relative path (e.g. /media/...).
    // Resolve it to the backend origin when possible so the browser requests the
    // uploaded file from Django (e.g. http://localhost:8000/media/...).
    try {
      const isAbsoluteApi = typeof API_BASE === 'string' && API_BASE.startsWith('http');
      const backendOrigin = isAbsoluteApi ? new URL(API_BASE).origin : (typeof window !== 'undefined' ? window.location.origin : '');
      if (raw.startsWith('/')) {
        if (backendOrigin) return backendOrigin + raw;
        return raw;
      }
    } catch (err) {
      // fallback
    }
    return raw;
  }
}

export function getImageAlt(p: any): string | undefined {
  return p?.image_alt || p?.imageAlt || p?.name || '';
}
