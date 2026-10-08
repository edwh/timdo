'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { IconSearch, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  Accordion,
  ActionIcon,
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Pill,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { DoneProjectList } from '../../components/DoneProjectList/DoneProjectList';
import { ProjectCard } from '../../components/ProjectCard/ProjectCard';
import { ProjectSection } from '../../components/ProjectSection/ProjectSection';
import { QuickSearchModal } from '../../components/SearchModal/QuickSearchModal';
import { canEditItem, joinNames, workspaceLabel } from '../../components/Team';
import {
  filterByAssigneeScope,
  useAssigneeScope,
  type AssigneeScope,
} from '../hooks/useAssigneeScope';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useOrganisations } from '../hooks/useOrganisationQueries';
import { useBatchUpdateProjects, useUpdateProject } from '../hooks/useProjectMutations';
import { useWorkspaceLookup, useWorkspaceMembersMap } from '../hooks/useWorkspaces';
import { apiFetch, readApiError } from '../lib/apiClient';
import { getWorkerApiBaseUrl } from '../lib/apiConfig';
import type {
  Project,
  ProjectSize,
  ProjectStatus,
  ProjectUpdateInput,
} from '../types/project.types';

async function fetchProjects(accessToken: string): Promise<Project[]> {
  const res = await apiFetch(`${getWorkerApiBaseUrl()}/projects`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw await readApiError(res, 'Failed to fetch projects');
  }
  return res.json();
}

const sizeToNumber = (size: ProjectSize): number => {
  switch (size) {
    case '*':
      return 1;
    case '**':
      return 2;
    case '***':
      return 3;
    case '****':
      return 4;
    case '*****':
      return 5;
    default:
      return 0;
  }
};

function recalculatePriorities(projects: Project[]): Project[] {
  const count = projects.length;
  if (count === 0) {
    return [];
  }
  if (count === 1) {
    return [{ ...projects[0], priority: 10 }];
  }

  return projects.map((p, index) => ({
    ...p,
    priority: Math.round(10 - (index * 9) / (count - 1)),
  }));
}

/** Category pills for one workspace on the board. */
interface CategoryGroup {
  orgId: string;
  label: string;
  isShared: boolean;
  categories: string[];
}

const SCOPE_EMPTY_COPY: Record<AssigneeScope, string> = {
  mine: "Nothing assigned to you yet. Switch to Everyone to see the whole team's work.",
  unassigned: 'Every task here has someone on it.',
  everyone: 'No tasks here yet. Press C or use Quick Add to create one.',
};

function BoardSkeleton() {
  return (
    <Stack gap="sm" role="status" aria-label="Loading projects">
      <Skeleton height={36} width={120} radius="sm" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={64} radius="md" />
      ))}
    </Stack>
  );
}

function BoardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get('category') || 'All';

  const { data: organisations = [] } = useOrganisations();
  const { userId } = useCurrentUser();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>(
    searchParams.get('customer') || 'all'
  );
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [assigneeScope, setAssigneeScope] = useAssigneeScope();

  // Customer badges on cards link to /board?customer=..., so follow the URL when it changes
  const customerParam = searchParams.get('customer');
  useEffect(() => {
    if (customerParam) {
      setSelectedCustomer(customerParam);
    }
  }, [customerParam]);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [delayExpanded, setDelayExpanded] = useState(true);
  const [awaitingExpanded, setAwaitingExpanded] = useState(false);
  const [doneExpanded, setDoneExpanded] = useState(true);
  const updateProjectMutation = useUpdateProject();
  const batchUpdateMutation = useBatchUpdateProjects();

  const handleCategorySelect = (category: string) => {
    if (category === 'All') {
      router.push('/board');
    } else {
      router.push(`/board?category=${encodeURIComponent(category)}`);
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Require the mouse to move by 10 pixels before activating
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      // Press delay of 250ms, with tolerance of 5px of movement
      // This matches the @dnd-kit docs example for better mobile experience
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const {
    data: projects,
    isLoading,
    isError,
    error,
  } = useQuery<Project[], Error>({
    queryKey: ['projects'],
    queryFn: () => {
      if (!session?.accessToken) {
        throw new Error('No access token available');
      }
      return fetchProjects(session.accessToken);
    },
    enabled: status === 'authenticated' && !!session?.accessToken,
  });

  const handleUpdateProject = (projectId: string, updates: ProjectUpdateInput) => {
    updateProjectMutation.mutate({
      projectId,
      data: updates,
    });
  };

  const handleStatusChange = (projectId: string, newStatus: ProjectStatus) => {
    updateProjectMutation.mutate({ projectId, data: { status: newStatus } });
  };

  // Anything shared? If not, the board stays exactly as it was for a solo user.
  const hasSharedTasks = useMemo(() => (projects || []).some((p) => p.isShared), [projects]);
  // "Unassigned" only means something in shared workspaces
  const scope: AssigneeScope =
    assigneeScope === 'unassigned' && !hasSharedTasks ? 'everyone' : assigneeScope;

  const sharedOrgIds = useMemo(
    () =>
      Array.from(
        new Set((projects || []).filter((p) => p.isShared && p.orgId).map((p) => p.orgId!))
      ),
    [projects]
  );
  const membersByOrg = useWorkspaceMembersMap(sharedOrgIds);
  const lookupWorkspace = useWorkspaceLookup();
  const sharedWithLabel = (orgId: string) =>
    joinNames(
      (membersByOrg[orgId] || [])
        .filter((m) => m.userId !== userId)
        .map((m) => m.userName || m.userEmail)
    );

  const filteredProjects = useMemo(() => {
    if (!projects) {
      return [];
    }
    let result = projects;

    // Filter by workspace if a specific one is chosen
    if (selectedOrgId !== 'all') {
      result = result.filter((p) => p.orgId === selectedOrgId);
    }

    // Mine / Everyone / Unassigned
    result = filterByAssigneeScope(result, scope);

    // Filter by dynamic project category pill
    if (selectedCategory !== 'All') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // Filter by Customer
    if (selectedCustomer !== 'all') {
      result = result.filter(
        (p) => p.customer && p.customer.toLowerCase() === selectedCustomer.toLowerCase()
      );
    }

    return result;
  }, [projects, selectedOrgId, selectedCategory, selectedCustomer, scope]);

  // Compute customers dynamically from projects
  const customerOptions = useMemo(() => {
    if (!projects) {
      return [{ value: 'all', label: 'All Customers' }];
    }
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.customer) {
        set.add(p.customer.trim());
      }
    });
    return [
      { value: 'all', label: 'All Customers' },
      ...Array.from(set).map((c) => ({ value: c, label: c })),
    ];
  }, [projects]);

  // Category (project) pills, grouped by workspace: personal first, then shared ones
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const pool =
      selectedOrgId === 'all'
        ? projects || []
        : (projects || []).filter((p) => p.orgId === selectedOrgId);
    const groups = new Map<string, CategoryGroup>();
    pool.forEach((p) => {
      if (!p.category) {
        return;
      }
      const key = p.orgId || 'personal';
      const group = groups.get(key) || {
        orgId: key,
        label: lookupWorkspace(p.orgId, p).label,
        isShared: !!p.isShared,
        categories: [],
      };
      if (!group.categories.includes(p.category)) {
        group.categories.push(p.category);
      }
      groups.set(key, group);
    });
    return Array.from(groups.values())
      .map((g) => ({ ...g, categories: g.categories.sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => Number(a.isShared) - Number(b.isShared) || a.label.localeCompare(b.label));
  }, [projects, selectedOrgId, lookupWorkspace]);

  const projectsByStatus = useMemo(() => {
    const data: Record<ProjectStatus, Project[]> = {
      do: [],
      delay: [],
      done: [],
      delegate: [],
      awaiting: [],
    };
    filteredProjects.forEach((p) => {
      if (p.status in data) {
        data[p.status as ProjectStatus].push(p);
      }
    });
    data.do.sort((a, b) => b.priority - a.priority || sizeToNumber(a.size) - sizeToNumber(b.size));
    data.delay.sort(
      (a, b) => b.priority - a.priority || sizeToNumber(a.size) - sizeToNumber(b.size)
    );
    data.awaiting.sort((a, b) => {
      const aDate = a.awaitUntil ? new Date(a.awaitUntil).getTime() : Infinity;
      const bDate = b.awaitUntil ? new Date(b.awaitUntil).getTime() : Infinity;
      if (aDate !== bDate) {
        return aDate - bDate;
      }
      return b.priority - a.priority;
    });
    data.done.sort((a, b) => {
      const aDate = a.statusLastChangedOn ? new Date(a.statusLastChangedOn).getTime() : 0;
      const bDate = b.statusLastChangedOn ? new Date(b.statusLastChangedOn).getTime() : 0;
      if (bDate !== aDate) {
        return bDate - aDate;
      }
      return b.priority - a.priority;
    });
    return data;
  }, [filteredProjects]);

  const handleDragStart = (event: DragStartEvent) => {
    if (projects) {
      setActiveProject(projects.find((p) => p.id === event.active.id) || null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveProject(null);
    const { active, over } = event;

    if (!over || !projects || active.id === over.id) {
      return;
    }

    const activeContainer = active.data.current?.sortable.containerId as ProjectStatus;
    const overContainer = (over.data.current?.sortable.containerId || over.id) as ProjectStatus;
    const activeId = active.id as string;

    // Block non-awaiting items from being dropped into Awaiting (they have no return date)
    if (overContainer === 'awaiting' && activeContainer !== 'awaiting') {
      return;
    }

    const movedProject = projects.find((p) => p.id === activeId);
    if (!movedProject || !canEditItem(movedProject)) {
      return;
    }

    // Renumber only what you can see, and only tasks in the dragged task's own workspace, so
    // reordering your column never rewrites a collaborator's priorities (or theirs, yours).
    const sameWorkspace = (p: Project) =>
      p.id !== activeId && p.orgId === movedProject.orgId && canEditItem(p);
    const newColumn = projectsByStatus[overContainer].filter(sameWorkspace);
    const overIndex = newColumn.findIndex((p) => p.id === over.id);
    newColumn.splice(overIndex === -1 ? newColumn.length : overIndex, 0, movedProject);

    const changed = (p: Project, priority: number, status: ProjectStatus) =>
      p.priority !== priority || p.status !== status;

    const updates = recalculatePriorities(newColumn)
      .map((p) => ({ id: p.id, priority: p.priority, status: overContainer }))
      .filter((u) => {
        const original = projects.find((p) => p.id === u.id);
        return !original || changed(original, u.priority, u.status);
      });

    if (activeContainer !== overContainer) {
      const oldColumn = projectsByStatus[activeContainer].filter(sameWorkspace);
      updates.push(
        ...recalculatePriorities(oldColumn)
          .map((p) => ({ id: p.id, priority: p.priority, status: activeContainer }))
          .filter((u) => {
            const original = projects.find((p) => p.id === u.id);
            return !original || changed(original, u.priority, u.status);
          })
      );
    }

    if (updates.length === 0) {
      return;
    }
    batchUpdateMutation.mutate(updates);

    // When dragging from awaiting to a non-awaiting container, clear the return date
    if (activeContainer === 'awaiting' && overContainer !== 'awaiting') {
      updateProjectMutation.mutate({
        projectId: activeId,
        data: { awaitUntil: null },
      });
    }
  };

  if (status === 'loading') {
    return <Loader role="status" aria-label="Loading session" />;
  }

  const orgList = (Array.isArray(organisations) ? organisations : []).filter(
    (org) => org && org.id && org.name
  );
  const orgOptions = [
    { value: 'all', label: 'All workspaces' },
    ...orgList
      .slice()
      .sort((a, b) => Number(!a.isPersonal) - Number(!b.isPersonal))
      .map((org) => ({
        value: String(org.id),
        label: workspaceLabel(org),
      })),
  ];

  const scopeOptions = [
    { label: 'Everyone', value: 'everyone' },
    { label: 'Mine', value: 'mine' },
    ...(hasSharedTasks ? [{ label: 'Unassigned', value: 'unassigned' }] : []),
  ];

  const visibleCount = filteredProjects.length;
  const showGroupLabels = categoryGroups.length > 1 || categoryGroups.some((g) => g.isShared);

  return (
    <Container>
      <Group justify="space-between" align="center" mb="md" wrap="wrap">
        <div>
          <Title order={1}>Your Board</Title>
          {hasSharedTasks && (
            <Text size="sm" c="dimmed">
              Your tasks and your team&apos;s, across all your workspaces.
            </Text>
          )}
        </div>
        <Tooltip label="Search tasks & notes (/)">
          <ActionIcon
            variant="default"
            size="lg"
            radius="md"
            onClick={() => setSearchModalOpen(true)}
            aria-label="Search tasks"
          >
            <IconSearch size={20} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Collaboration controls: workspace, customer and Mine / Everyone */}
      <Group justify="space-between" align="flex-end" mb="md" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="wrap">
          {orgList.length > 1 && (
            <Select
              label="Workspace"
              data={orgOptions}
              value={selectedOrgId}
              onChange={(val) => setSelectedOrgId(val || 'all')}
              allowDeselect={false}
              size="sm"
              style={{ width: 200 }}
            />
          )}
          <Select
            label="Customer"
            data={customerOptions}
            value={selectedCustomer}
            onChange={(val) => setSelectedCustomer(val || 'all')}
            allowDeselect={false}
            size="sm"
            style={{ width: 180 }}
          />
        </Group>
        <Tooltip
          label="Mine: assigned to you, or unassigned tasks you created"
          withArrow
          openDelay={400}
        >
          <SegmentedControl
            aria-label="Whose tasks to show"
            value={scope}
            onChange={(val) => setAssigneeScope(val as AssigneeScope)}
            data={scopeOptions}
          />
        </Tooltip>
      </Group>

      {/* Category (project) filter pills, grouped by workspace */}
      <Group gap="xs" mb="lg" align="center">
        <CategoryPill
          label="All"
          active={selectedCategory === 'All'}
          onClick={() => handleCategorySelect('All')}
        />
        {categoryGroups.map((group) => (
          <Group key={group.orgId} gap={6} align="center" wrap="wrap">
            {showGroupLabels && (
              <Tooltip
                label={
                  group.isShared
                    ? sharedWithLabel(group.orgId)
                      ? `Shared with ${sharedWithLabel(group.orgId)}`
                      : 'Shared workspace'
                    : 'Only you can see these'
                }
                withArrow
              >
                <Group gap={4} ml="xs" wrap="nowrap" data-testid={`workspace-label-${group.orgId}`}>
                  {group.isShared && <IconUsers size={14} color="var(--mantine-color-grape-6)" />}
                  <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                    {group.label}
                  </Text>
                </Group>
              </Tooltip>
            )}
            {group.categories.map((cat) => (
              <CategoryPill
                key={`${group.orgId}-${cat}`}
                label={cat}
                active={selectedCategory === cat}
                shared={group.isShared}
                onClick={() => handleCategorySelect(cat)}
              />
            ))}
          </Group>
        ))}
      </Group>

      {isLoading && <BoardSkeleton />}
      {isError && (
        <Alert title="Error" color="red">
          There was a problem fetching your projects: {error.message}
        </Alert>
      )}

      {projects && visibleCount === 0 && (
        <Paper withBorder radius="md" p="xl" mb="lg" data-testid="board-empty">
          <Stack align="center" gap="sm">
            <Text c="dimmed" ta="center">
              {selectedCategory !== 'All' || selectedCustomer !== 'all' || selectedOrgId !== 'all'
                ? 'No tasks match these filters.'
                : SCOPE_EMPTY_COPY[scope]}
            </Text>
            {scope !== 'everyone' && (
              <Button variant="light" size="xs" onClick={() => setAssigneeScope('everyone')}>
                Show everyone&apos;s tasks
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {projects && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Stack>
            {/* biome-ignore lint/nursery/useUniqueElementIds: ID is static for dnd-kit context */}
            <ProjectSection
              id="do"
              title="Do"
              projects={projectsByStatus.do}
              alwaysExpanded
              onUpdateProject={handleUpdateProject}
              onStatusChange={handleStatusChange}
            />
            {/* biome-ignore lint/nursery/useUniqueElementIds: ID is static for dnd-kit context */}
            {projectsByStatus.delay.length > 0 && (
              <Stack component="section" mb="xl" data-testid="section-delay">
                <Title
                  order={2}
                  fz="h1"
                  c="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDelayExpanded(!delayExpanded)}
                >
                  {delayExpanded ? '▼' : '▶'} Delay ({projectsByStatus.delay.length})
                </Title>
                {delayExpanded && (
                  <ProjectSection
                    id="delay"
                    title=""
                    projects={projectsByStatus.delay}
                    alwaysExpanded
                    onUpdateProject={handleUpdateProject}
                    onStatusChange={handleStatusChange}
                  />
                )}
              </Stack>
            )}
            {projectsByStatus.delay.length === 0 && (
              <ProjectSection
                id="delay"
                title="Delay"
                projects={projectsByStatus.delay}
                onUpdateProject={handleUpdateProject}
                onStatusChange={handleStatusChange}
              />
            )}
            {projectsByStatus.awaiting.length > 0 && (
              <Stack component="section" mb="xl" data-testid="section-awaiting">
                <Title
                  order={2}
                  fz="h1"
                  c="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setAwaitingExpanded(!awaitingExpanded)}
                >
                  {awaitingExpanded ? '▼' : '▶'} ⏳ Awaiting ({projectsByStatus.awaiting.length})
                </Title>
                {awaitingExpanded && (
                  <ProjectSection
                    id="awaiting"
                    title=""
                    projects={projectsByStatus.awaiting}
                    alwaysExpanded
                    onUpdateProject={handleUpdateProject}
                    onStatusChange={handleStatusChange}
                  />
                )}
              </Stack>
            )}
            {projectsByStatus.awaiting.length === 0 && (
              <ProjectSection
                id="awaiting"
                title="⏳ Awaiting (0)"
                projects={projectsByStatus.awaiting}
                defaultOpen={false}
                onUpdateProject={handleUpdateProject}
                onStatusChange={handleStatusChange}
              />
            )}
            {projectsByStatus.done.length > 0 && (
              <Stack component="section" mb="xl" data-testid="section-done">
                <Title
                  order={2}
                  fz="h1"
                  c="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDoneExpanded(!doneExpanded)}
                >
                  {doneExpanded ? '▼' : '▶'} Done ({projectsByStatus.done.length})
                </Title>
                {doneExpanded && <DoneProjectList title="" projects={projectsByStatus.done} />}
              </Stack>
            )}
            {projectsByStatus.done.length === 0 && (
              <DoneProjectList title="Done" projects={projectsByStatus.done} />
            )}
          </Stack>
          <DragOverlay>
            {activeProject ? (
              <Accordion variant="separated" defaultValue={activeProject.id}>
                <ProjectCard
                  project={activeProject}
                  onUpdate={() => {}}
                  onStatusChange={() => {}}
                />
              </Accordion>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <QuickSearchModal opened={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    </Container>
  );
}

function CategoryPill({
  label,
  active,
  shared = false,
  onClick,
}: {
  label: string;
  active: boolean;
  shared?: boolean;
  onClick: () => void;
}) {
  return (
    <Pill
      size="md"
      role="button"
      tabIndex={0}
      aria-pressed={active}
      style={{
        cursor: 'pointer',
        backgroundColor: active
          ? `var(--mantine-color-${shared ? 'grape' : 'blue'}-filled)`
          : 'var(--mantine-color-default)',
        color: active ? 'var(--mantine-color-white)' : 'var(--mantine-color-text)',
        fontWeight: active ? 600 : 400,
        border: '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {label}
    </Pill>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<Loader role="status" aria-label="Loading board" />}>
      <BoardContent />
    </Suspense>
  );
}
