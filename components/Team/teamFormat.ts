/**
 * @fileoverview Helpers for showing people and workspaces: initials, avatar colours, "You"
 * labels, workspace names and relative times. The initials and colour rules match the activity
 * feed so the same person looks the same everywhere.
 * @module components/Team/teamFormat
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

/**
 * Name to show for a person: "You" for the signed-in user, otherwise their name.
 * Pass `capitalise: false` for mid-sentence use ("assigned to you").
 */
export function personLabel(
  name: string | null | undefined,
  id: string | null | undefined,
  meId: string | null | undefined,
  { capitalise = true }: { capitalise?: boolean } = {}
): string {
  if (id && meId && id === meId) {
    return capitalise ? 'You' : 'you';
  }
  return name || 'Someone';
}

/** First name only, for tight spaces ("Robin Fairweather" -> "Robin"). */
export function firstName(name: string | null | undefined): string {
  const value = (name || '').trim();
  if (!value) {
    return '';
  }
  return value.includes('@') ? value.split('@')[0] : value.split(/\s+/)[0];
}

/** Workspace display name: the personal workspace is always just "Personal". */
export function workspaceLabel(
  workspace: { name?: string | null; isPersonal?: boolean | null } | null | undefined
): string {
  if (!workspace) {
    return 'Personal';
  }
  if (workspace.isPersonal) {
    return 'Personal';
  }
  return workspace.name || 'Workspace';
}

/**
 * "Robin", "Robin and Sam", "Robin, Sam and 2 others". Used for "Shared with ..." labels.
 */
export function joinNames(names: string[], max = 2): string {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length === 0) {
    return '';
  }
  if (unique.length === 1) {
    return unique[0];
  }
  if (unique.length <= max) {
    return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
  }
  const rest = unique.length - max;
  return `${unique.slice(0, max).join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
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
export function relativeTime(value: string | Date | null | undefined, now: Date = new Date()) {
  const date = value instanceof Date ? value : parseTimestamp(value);
  if (!date) {
    return '';
  }
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
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** Full UK date and time for tooltips: "8 Oct 2026, 14:05". */
export function absoluteTime(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseTimestamp(value);
  if (!date) {
    return '';
  }
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Items from older API responses have no `canEdit`; treat them as editable. */
export function canEditItem(item: { canEdit?: boolean | null } | null | undefined): boolean {
  return item?.canEdit !== false;
}

/** Copy for the "you can't change this" tooltip. */
export const VIEW_ONLY_LABEL = 'View only: you can see this but not change it';
