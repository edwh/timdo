import React from 'react';
import Link from 'next/link';
import { Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useCurrentUser } from '../../app/hooks/useCurrentUser';
import type { Project } from '../../app/types/project.types';
import { personLabel, TeamAvatar } from '../Team';
import classes from './DoneProjectList.module.css';

interface DoneProjectListProps {
  title: string;
  projects: Project[];
}

export function DoneProjectList({ title, projects }: DoneProjectListProps) {
  const { userId } = useCurrentUser();

  if (projects.length === 0) {
    return null;
  }

  return (
    <Stack component="section" mb="xl" data-testid={`section-${title.toLowerCase()}`}>
      <Title order={2} fz="h1" c="blue">
        {title}
      </Title>
      <Paper withBorder p="md" className={classes.doneList}>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
          {projects.map((project) => (
            <div key={project.id} className={classes.listItem} data-testid="done-project-item">
              <Group gap={6} wrap="nowrap">
                {project.isShared && project.assigneeId && (
                  <TeamAvatar
                    name={project.assigneeName}
                    seed={project.assigneeId}
                    size={18}
                    tooltip={`Assigned to ${personLabel(project.assigneeName, project.assigneeId, userId, { capitalise: false })}`}
                  />
                )}
                <Text
                  component={Link}
                  href={`/tasks/${project.id}`}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {project.project}
                </Text>
              </Group>
            </div>
          ))}
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}
