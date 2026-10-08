import { describe, expect, it } from 'vitest';
import { generateActiveTasksPosterSvg } from '../services/activePosterService';

describe('activePosterService', () => {
  describe('generateActiveTasksPosterSvg', () => {
    it('groups active tasks by category and renders A2 portrait SVG', () => {
      const mockTasks = [
        {
          id: '1',
          project: 'Solar quote',
          reason: 'Phil review',
          status: 'do',
          size: '***',
          priority: 10,
          category: 'Solfit',
        },
        {
          id: '2',
          project: 'App setup',
          reason: 'Riley roofers',
          status: 'do',
          size: '***',
          priority: 9,
          category: 'Migrating Dragons',
        },
      ];
      const svg = generateActiveTasksPosterSvg({ tasks: mockTasks as any });
      expect(svg).toContain('DO');
      expect(svg).toContain('Solar quote');
      expect(svg).toContain('Phil review');
      expect(svg).toContain('viewBox="0 0 420 594"');
    });

    it('filters out done tasks (only includes do, awaiting, delay)', () => {
      const mockTasks = [
        { id: '1', project: 'Active task 1', status: 'do', category: 'Solfit' },
        { id: '2', project: 'Done task', status: 'done', category: 'Solfit' },
        {
          id: '3',
          project: 'Awaiting task',
          status: 'awaiting',
          awaitUntil: '2026-10-01',
          category: 'Solfit',
        },
        { id: '4', project: 'Delayed task', status: 'delay', category: 'Personal' },
      ];
      const svg = generateActiveTasksPosterSvg({ tasks: mockTasks as any });
      expect(svg).toContain('Active task 1');
      expect(svg).toContain('Awaiting task');
      expect(svg).toContain('Delayed task');
      expect(svg).not.toContain('Done task');
    });

    it('filters by selected categories when specified (including Crew alias for Caving Crew)', () => {
      const mockTasks = [
        { id: '1', project: 'Solar quote', status: 'do', category: 'Solfit' },
        { id: '2', project: 'App setup', status: 'do', category: 'Migrating Dragons' },
        { id: '3', project: 'Dentist', status: 'do', category: 'Personal' },
        { id: '4', project: 'Tackle bag check', status: 'do', category: 'Crew' },
      ];
      const svg = generateActiveTasksPosterSvg({
        tasks: mockTasks as any,
        categories: ['Crew'],
      });
      expect(svg).toContain('CREW');
      expect(svg).toContain('Tackle bag check');
      expect(svg).not.toContain('Solar quote');
      expect(svg).not.toContain('App setup');
    });

    it('renders classic layout with DO, AWAITING, and DELAY sections', () => {
      const mockTasks = [
        { id: '1', project: 'Do task', status: 'do', category: 'Solfit' },
        {
          id: '2',
          project: 'Wait task',
          status: 'awaiting',
          awaitUntil: '2026-10-15',
          category: 'Solfit',
        },
        { id: '3', project: 'Pause task', status: 'delay', category: 'Solfit' },
      ];
      const svg = generateActiveTasksPosterSvg({ tasks: mockTasks as any });
      expect(svg).toContain('DO');
      expect(svg).toContain('AWAITING');
      expect(svg).toContain('DELAY');
      expect(svg).toContain('15 Oct');
    });

    it('renders size indicators and cleans task prefix', () => {
      const mockTasks = [
        {
          id: '1',
          project: 'Solfit: Cleaned task name',
          status: 'do',
          size: '****',
          category: null,
        },
      ];
      const svg = generateActiveTasksPosterSvg({ tasks: mockTasks as any });
      expect(svg).toContain('Cleaned task name');
      expect(svg).toContain('★★★★');
    });

    it('escapes XML special characters in task titles and reasons', () => {
      const mockTasks = [
        {
          id: '1',
          project: 'Fix <script> & "bugs"',
          reason: 'Why: a > b & c < d',
          status: 'do',
          category: 'Personal',
        },
      ];
      const svg = generateActiveTasksPosterSvg({ tasks: mockTasks as any });
      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
      expect(svg).toContain('&amp;');
    });

    it('handles empty task list gracefully', () => {
      const svg = generateActiveTasksPosterSvg({ tasks: [] });
      expect(svg).toContain('viewBox="0 0 420 594"');
      expect(svg).toContain('PROJECTS');
    });
  });
});
