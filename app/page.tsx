'use client';

/**
 * @fileoverview Main landing page for the application.
 * @module app/page
 */
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconBolt, IconDownload, IconMicrophone } from '@tabler/icons-react';
import { signIn, useSession } from 'next-auth/react';
import {
  Anchor,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { FeatureCard } from '../components/FeatureCard/FeatureCard';
import { needsOnboarding } from './hooks/onboardingGate';
import { fetchOrganisations, getProjects } from './lib/apiClient';
import classes from './HomePage.module.css';

export default function HomePage() {
  const { status, data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    const checkOnboarding = async () => {
      if (status === 'authenticated' && session?.accessToken) {
        try {
          // New users go to onboarding, unless someone has already shared a workspace with them
          const [tasks, orgs] = await Promise.all([
            getProjects(session.accessToken),
            fetchOrganisations(session.accessToken).catch(() => null),
          ]);
          // If workspaces couldn't load, don't risk pushing a collaborator into onboarding
          router.push(orgs && needsOnboarding(tasks.length, orgs) ? '/onboarding' : '/board');
        } catch {
          router.push('/board');
        }
      }
    };

    checkOnboarding();
  }, [status, session, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <Container
        className={classes.container}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Loader />
      </Container>
    );
  }

  return (
    <>
      {/* Hero Section */}
      <Container size="lg" className={classes.heroSection}>
        <Stack align="center" gap="xl">
          <Title
            order={1}
            ta="center"
            className={classes.heroTitle}
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            Life Management Without the Overwhelm
          </Title>
          <Text ta="center" size="xl" c="dimmed" maw={700} className={classes.heroSubtitle}>
            Get everything out of your head and into a visual board. Keep track of your life, not
            your tools. Export to poster. Control with your voice.
          </Text>
          <Group gap="md" mt="md">
            <Button size="lg" onClick={() => signIn('auth0')} className={classes.primaryButton}>
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => signIn('auth0')}
              className={classes.secondaryButton}
            >
              Sign In
            </Button>
          </Group>
        </Stack>
      </Container>

      {/* Features Section */}
      <Container size="lg" className={classes.featuresSection}>
        <Title order={2} ta="center" mb="xl" className={classes.sectionTitle}>
          Finally, a tool that works the way you think
        </Title>
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <FeatureCard
              icon={IconDownload}
              title="Print Your Progress"
              description="Export your board as a beautiful SVG poster. Pin it to your wall, share it with your team, or just see everything at once. Your life, visualized."
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <FeatureCard
              icon={IconMicrophone}
              title="Speak, Don't Type"
              description="Update projects with your voice while cooking, driving, or just thinking out loud. AI understands what needs to change and does it instantly."
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <FeatureCard
              icon={IconBolt}
              title="No Feature Bloat"
              description="Drag to prioritize. Click to edit. That's it. No wikis, no timelines, no Gantt charts. Just you and your tasks, nothing else."
            />
          </Grid.Col>
        </Grid>
      </Container>

      {/* Creator Section */}
      <Container size="md" className={classes.creatorSection}>
        <Paper shadow="sm" p="xl" radius="md" className={classes.creatorCard}>
          <Stack align="center" gap="md">
            <Title order={3} ta="center" className={classes.creatorTitle}>
              Built by someone who gets it
            </Title>
            <Title order={4} ta="center" fw={500}>
              Made by Tim Dobson
            </Title>
            <Text ta="center" c="dimmed" maw={600}>
              Full-stack developer and technology leader who got tired of complicated tools getting
              in the way of getting things done. Built TimDo to solve his own problem: a simple,
              visual way to manage life without the bloat.
            </Text>
            <Text ta="center" c="dimmed" size="sm">
              Technology Leader & Community Builder
            </Text>
            <Group gap="xs">
              <Anchor
                href="https://linkedin.com/in/tdobson"
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
              >
                LinkedIn
              </Anchor>
              <Text c="dimmed" size="sm">
                |
              </Text>
              <Anchor
                href="https://github.com/tdobson"
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
              >
                GitHub
              </Anchor>
              <Text c="dimmed" size="sm">
                |
              </Text>
              <Anchor
                href="https://tdobson.net"
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
              >
                Website
              </Anchor>
            </Group>
          </Stack>
        </Paper>
      </Container>

      {/* Final CTA Section */}
      <Box className={classes.ctaSection}>
        <Container size="sm">
          <Stack align="center" gap="lg">
            <Title order={2} ta="center" className={classes.ctaTitle}>
              Ready to clear your head?
            </Title>
            <Text ta="center" size="lg" c="dimmed">
              Start managing your life in minutes. No credit card, no setup hassle. Just sign in and
              start.
            </Text>
            <Stack gap="sm" align="center">
              <Button size="xl" onClick={() => signIn('auth0')} className={classes.primaryButton}>
                Get Started
              </Button>
              <Button
                size="md"
                variant="subtle"
                onClick={() => signIn('auth0')}
                className={classes.secondaryButton}
              >
                Sign In
              </Button>
            </Stack>
            <Text size="sm" c="dimmed" ta="center" mt="md">
              Free to use. Built with Next.js, hosted on Cloudflare.
            </Text>
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <Box component="footer" className={classes.footer}>
        <Container size="lg">
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              © 2025 Tim Dobson
            </Text>
            <Group gap="xs">
              <Anchor
                href="https://github.com/tdobson"
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                c="dimmed"
              >
                GitHub
              </Anchor>
              <Text c="dimmed" size="sm">
                |
              </Text>
              <Anchor href="mailto:tim@example.com" size="sm" c="dimmed">
                Contact
              </Anchor>
            </Group>
          </Group>
          <Text size="xs" c="dimmed" ta="center" mt="xs">
            Built with Next.js, Mantine, Cloudflare
          </Text>
        </Container>
      </Box>
    </>
  );
}
