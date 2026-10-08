/**
 * @fileoverview Feature card component for landing page
 * @module components/FeatureCard
 */
import React from 'react';
import { Card, Text, ThemeIcon, Title } from '@mantine/core';
import classes from './FeatureCard.module.css';

interface FeatureCardProps {
  icon: React.ComponentType<{ size?: number | string; stroke?: number; color?: string }>;
  title: string;
  description: string;
}

/**
 * Displays a feature with icon, title, and description
 *
 * @param {React.ForwardRefExoticComponent} props.icon - Tabler icon component
 * @param {string} props.title - Feature title
 * @param {string} props.description - Feature description
 * @returns {JSX.Element} Feature card component
 *
 * @example
 * <FeatureCard
 *   icon={IconPrinter}
 *   title="Print Your Progress"
 *   description="Export your board as a beautiful SVG poster."
 * />
 */
export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" className={classes.card}>
      <ThemeIcon size={60} radius="md" className={classes.icon}>
        <Icon size={36} />
      </ThemeIcon>
      <Title order={3} mt="md" className={classes.title}>
        {title}
      </Title>
      <Text size="sm" c="dimmed" mt="sm" className={classes.description}>
        {description}
      </Text>
    </Card>
  );
}
