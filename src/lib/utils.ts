import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely converts any timestamp-like value (number, Firestore Timestamp, ISO string, Date)
 * into a valid Date instance, or null if invalid.
 */
export function toSafeDate(val: any): Date | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    return new Date(val);
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  // Firestore Timestamp object or object with toMillis / seconds
  if (typeof val === 'object') {
    if (typeof val.toMillis === 'function') {
      try {
        const ms = val.toMillis();
        return isNaN(ms) ? null : new Date(ms);
      } catch (e) {
        // fallback
      }
    }
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        return isNaN(d.getTime()) ? null : d;
      } catch (e) {
        // fallback
      }
    }
    if (typeof val.seconds === 'number') {
      const ms = val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0);
      return isNaN(ms) ? null : new Date(ms);
    }
    if (typeof val._seconds === 'number') {
      const ms = val._seconds * 1000;
      return isNaN(ms) ? null : new Date(ms);
    }
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return new Date(parsed);
    const num = Number(val);
    if (!isNaN(num) && num > 0) return new Date(num);
  }
  return null;
}

/**
 * Safely formats any date-like value without throwing RangeError: Invalid time value.
 */
export function safeFormat(val: any, formatStr: string, fallback = '—'): string {
  try {
    const d = toSafeDate(val);
    if (!d) return fallback;
    return format(d, formatStr);
  } catch (e) {
    return fallback;
  }
}

/**
 * Safely calculates formatDistanceToNow without throwing RangeError.
 */
export function safeDistanceToNow(val: any, options?: { addSuffix?: boolean }, fallback = 'recently'): string {
  try {
    const d = toSafeDate(val);
    if (!d) return fallback;
    return formatDistanceToNow(d, options);
  } catch (e) {
    return fallback;
  }
}

/**
 * Safely calculates difference in days between two date-like values.
 */
export function safeDifferenceInDays(dateLeft: any, dateRight: any, fallback = 0): number {
  try {
    const dLeft = toSafeDate(dateLeft);
    const dRight = toSafeDate(dateRight);
    if (!dLeft || !dRight) return fallback;
    return differenceInDays(dLeft, dRight);
  } catch (e) {
    return fallback;
  }
}

/**
 * Safely extracts epoch milliseconds from any date-like value.
 */
export function toSafeMillis(val: any, fallback = 0): number {
  const d = toSafeDate(val);
  return d ? d.getTime() : fallback;
}
