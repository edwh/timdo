import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Accordion, Stack, Title } from '@mantine/core';
import type { Project, ProjectStatus, ProjectUpdateInput } from '../../app/types/project.types';
import { ProjectCard } from '../ProjectCard/ProjectCard';

interface ProjectSectionProps {
  id: string;
  title: string;
  projects: Project[];
  defaultOpen?: boolean;
  alwaysExpanded?: boolean;
  onUpdateProject: (projectId: string, updates: ProjectUpdateInput) => void;
  onStatusChange: (projectId: string, newStatus: ProjectStatus) => void;
}

export function ProjectSection({
  id,
  title,
  projects,
  defaultOpen = false,
  alwaysExpanded = false,
  onUpdateProject,
  onStatusChange,
}: ProjectSectionProps) {
  if (projects.length === 0) {
    return null;
  }

  const allProjectIds = projects.map((p) => p.id);
  const defaultAccordionValue: string[] = defaultOpen || alwaysExpanded ? allProjectIds : [];

  // For always expanded sections, use controlled accordion that prevents collapse
  const accordionProps = alwaysExpanded
    ? {
        value: allProjectIds,
        onChange: () => {}, // Prevent any changes
      }
    : {
        defaultValue: defaultAccordionValue,
      };

  return (
    <Stack component="section" mb="xl" data-testid={`section-${id}`}>
      <Title order={2} fz="h1" c="blue">
        {title}
      </Title>
      <SortableContext id={id} items={allProjectIds} strategy={verticalListSortingStrategy}>
        <Accordion<true> multiple {...accordionProps} variant="separated">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onUpdate={onUpdateProject}
              onStatusChange={onStatusChange}
              disableCollapse={alwaysExpanded}
            />
          ))}
        </Accordion>
      </SortableContext>
    </Stack>
  );
}
