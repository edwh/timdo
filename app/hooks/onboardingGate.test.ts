import type { Project } from '../types/project.types';
import { isInSharedWorkspace, needsOnboarding } from './onboardingGate';
import { filterByAssigneeScope } from './useAssigneeScope';

describe('needsOnboarding', () => {
  const personal = {
    id: 'p',
    name: 'Me',
    slug: 'me',
    createdBy: 'me',
    isPersonal: true,
    memberCount: 1,
  };
  const shared = {
    id: 's',
    name: 'Team',
    slug: 'team',
    createdBy: 'tim',
    isPersonal: false,
    memberCount: 2,
  };

  it('only onboards users with no tasks and no shared workspace', () => {
    expect(needsOnboarding(0, [personal])).toBe(true);
    expect(needsOnboarding(0, [personal, shared])).toBe(false);
    expect(needsOnboarding(3, [personal])).toBe(false);
  });

  it('treats any non-personal or multi-member workspace as shared', () => {
    expect(isInSharedWorkspace([personal])).toBe(false);
    expect(isInSharedWorkspace([{ ...personal, memberCount: 2 }])).toBe(true);
    expect(isInSharedWorkspace([{ ...shared, memberCount: 1 }])).toBe(true);
    expect(isInSharedWorkspace([])).toBe(false);
  });
});

describe('filterByAssigneeScope', () => {
  const base = {
    userId: 'u',
    status: 'do',
    priority: 5,
    size: '*',
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
  } as const;
  const tasks: Project[] = [
    { ...base, id: 'mine', project: 'Mine', isMine: true, assigneeId: 'me' },
    { ...base, id: 'theirs', project: 'Theirs', isMine: false, assigneeId: 'ed' },
    { ...base, id: 'nobody', project: 'Nobody', isMine: false, assigneeId: null },
    // Older responses without isMine count as mine
    { ...base, id: 'legacy', project: 'Legacy' },
  ];

  it('keeps everything for Everyone', () => {
    expect(filterByAssigneeScope(tasks, 'everyone')).toHaveLength(4);
  });

  it('uses isMine for Mine', () => {
    expect(filterByAssigneeScope(tasks, 'mine').map((t) => t.id)).toEqual(['mine', 'legacy']);
  });

  it('keeps only tasks with no assignee for Unassigned', () => {
    expect(filterByAssigneeScope(tasks, 'unassigned').map((t) => t.id)).toEqual([
      'nobody',
      'legacy',
    ]);
  });
});
