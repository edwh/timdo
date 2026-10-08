/**
 * @fileoverview Small, dependency-free helpers for showing activity and people:
 * initials, avatar colours, relative and absolute times (UK format).
 */

/** "Robin Fairweather" -> "RF", "robin@example.com" -> "RO", "" -> "?" */
export function initials(nameOrEmail: string | null | undefined): string {
  const value = (nameOrEmail || '').trim();
  if (!value) {
    return '?';
  }
  const base = value.includes('@') ? value.split('@')[0] : value;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2 && !value.includes('@')) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

const AVATAR_COLOURS = [
  'blue',
  'teal',
  'violet',
  'grape',
  'orange',
  'cyan',
  'indigo',
  'pink',
  'lime',
];

/** A stable Mantine colour for a person, so the same person always gets the same avatar. */
export function avatarColour(seed: string | null | undefined): string {
  const s = seed || '';
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}

/** Parse API timestamps. SQLite-style "2026-10-08 10:05:44" values are UTC. */
export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const normalised = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "just now", "5m ago", "2h ago", "3d ago", then "8 Oct" (or "8 Oct 2025" for other years). */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) {
    return 'just now';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
}

/** "Wed 8 Oct 2026, 14:05" */
export function absoluteTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today", "Yesterday", "Monday 6 October", or "Monday 6 October 2025" for other years. */
export function dayLabel(date: Date, now: Date = new Date()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
}

/** Lower-case the first letter of a summary so it reads on from a name ("Tim moved ..."). */
export function continueSentence(summary: string): string {
  if (summary.length < 2) {
    return summary.toLowerCase();
  }
  const [first, second] = summary;
  // Leave acronyms and names alone ("TimDo ...", "UK Solar ...")
  if (second === second.toUpperCase() && second !== second.toLowerCase()) {
    return summary;
  }
  return first.toLowerCase() + summary.slice(1);
}

/** Split a summary around its first quoted title so the title can be a link. */
export function splitQuoted(
  summary: string
): { before: string; quoted: string; after: string } | null {
  const match = /"([^"]+)"/.exec(summary);
  if (!match) {
    return null;
  }
  return {
    before: summary.slice(0, match.index),
    quoted: match[1],
    after: summary.slice(match.index + match[0].length),
  };
}
