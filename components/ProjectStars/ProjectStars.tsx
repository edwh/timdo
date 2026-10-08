import React from 'react';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { ActionIcon, Group, Text } from '@mantine/core';
import type { ProjectSize } from '../../app/types/project.types';
import classes from './ProjectStars.module.css';

interface ProjectStarsProps {
  size: ProjectSize;
  onUpdate?: (newSize: ProjectSize) => void;
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

const numberToSize = (num: number): ProjectSize => {
  switch (num) {
    case 1:
      return '*';
    case 2:
      return '**';
    case 3:
      return '***';
    case 4:
      return '****';
    case 5:
      return '*****';
    default:
      return '*';
  }
};

export function ProjectStars({ size, onUpdate }: ProjectStarsProps) {
  const filledCount = sizeToNumber(size);
  const starValues: number[] = [1, 2, 3, 4, 5];

  if (filledCount === 0 && !onUpdate) {
    return null;
  }

  return (
    <Group gap={2} wrap="nowrap" className={classes.starsContainer}>
      {onUpdate ? (
        starValues.map((star) => (
          <ActionIcon
            key={star}
            variant="transparent"
            color="yellow"
            onClick={(e) => {
              e.stopPropagation(); // Prevent accordion from toggling
              onUpdate(numberToSize(star));
            }}
            aria-label={`Set rating to ${star}`}
          >
            {star <= filledCount ? <IconStarFilled /> : <IconStar />}
          </ActionIcon>
        ))
      ) : (
        <Text component="span" c="yellow.6" size="lg">
          {'★'.repeat(filledCount)}
        </Text>
      )}
    </Group>
  );
}
