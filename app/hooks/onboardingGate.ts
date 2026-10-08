import type { Organisation } from '../types/organisation.types';

/**
 * True when someone is in a workspace with other people: a non-personal workspace, or any
 * workspace with more than one member.
 */
export function isInSharedWorkspace(orgs: Organisation[] | null | undefined): boolean {
  return (orgs || []).some(
    (org) => org && (org.isPersonal === false || (org.memberCount ?? 0) > 1)
  );
}

/**
 * Onboarding is for brand new, solo users only. Someone who was invited into a shared workspace
 * (like Robin) already has work to look at, even with no tasks of their own.
 */
export function needsOnboarding(
  visibleTaskCount: number,
  orgs: Organisation[] | null | undefined
): boolean {
  return visibleTaskCount === 0 && !isInSharedWorkspace(orgs);
}
