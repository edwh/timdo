import { Hono } from 'hono';
import type { Env } from '../index';
import { parseOnboardingProjects, processVoiceCommand } from '../services/aiService';
import { loadVoiceContext } from '../services/voiceContextService';

const aiApp = new Hono<{ Bindings: Env }>();

// The auth middleware is now applied in src/index.ts, so we remove it from here.

aiApp.post('/voice-command', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');
    const projectsJson = formData.get('projects');

    if (!audioFile || typeof audioFile === 'string') {
      return c.json({ error: 'Audio file is required' }, 400);
    }

    // The client's cached task list is optional now: it saves a database read when it is
    // current, but permissions, workspaces and people always come from the database.
    let clientTasks: unknown;
    if (typeof projectsJson === 'string' && projectsJson.trim()) {
      try {
        clientTasks = JSON.parse(projectsJson);
      } catch {
        return c.json({ error: 'Projects JSON is not valid' }, 400);
      }
    }

    const groqApiKey = c.env.GROQ_API_KEY;

    if (!groqApiKey) {
      return c.json({ error: 'Server configuration error: Missing Groq API key' }, 500);
    }

    const context = await loadVoiceContext(c.get('db'), c.get('userId'), clientTasks);

    const result = await processVoiceCommand({
      audioFile,
      groqApiKey,
      context,
    });

    return c.json(result);
  } catch (error) {
    console.error('Error processing voice command:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Failed to process voice command', details: message }, 500);
  }
});

aiApp.post('/parse-onboarding', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || typeof audioFile === 'string') {
      return c.json({ error: 'Audio file is required' }, 400);
    }

    const groqApiKey = c.env.GROQ_API_KEY;

    if (!groqApiKey) {
      return c.json({ error: 'Server configuration error: Missing Groq API key' }, 500);
    }

    const result = await parseOnboardingProjects({
      audioFile,
      groqApiKey,
    });

    return c.json(result);
  } catch (error) {
    console.error('Error parsing onboarding projects:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Failed to parse onboarding projects', details: message }, 500);
  }
});

export default aiApp;
