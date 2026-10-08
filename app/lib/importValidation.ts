import { z } from 'zod';
import type { ProjectCreateInput } from '../types/project.types';

// Zod schema for imported project (snake_case format)
const importedProjectSchema = z.object({
  id: z.string().uuid().optional(),
  project: z.string().min(1),
  reason: z.string().optional(),
  status: z.enum(['do', 'delay', 'done', 'delegate', 'awaiting', 'deleted']),
  priority: z.number().int().min(1).max(10),
  size: z.enum(['*', '**', '***', '****', '*****']),
  notes: z.string().optional(),
  status_last_changed_on: z.string().optional(),
});

// Schema for the entire import file
const importFileSchema = z.object({
  metadata: z
    .object({
      title: z.string().optional(),
      last_updated: z.string().optional(),
      version: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  schema: z.any().optional(),
  projects: z.array(importedProjectSchema),
});

export type ImportedProject = z.infer<typeof importedProjectSchema>;
export type ImportFile = z.infer<typeof importFileSchema>;

/**
 * Validates and parses an imported JSON file
 */
export function validateImportFile(data: unknown): ImportFile {
  return importFileSchema.parse(data);
}

/**
 * Converts imported projects (snake_case) to ProjectCreateInput (camelCase)
 * Filters out deleted projects by default
 */
export function convertImportedProjects(
  importedProjects: ImportedProject[],
  options: { includeDeleted?: boolean } = {}
): ProjectCreateInput[] {
  return importedProjects
    .filter((p) => options.includeDeleted || p.status !== 'deleted')
    .map((p) => ({
      project: p.project,
      reason: p.reason || '',
      status: p.status === 'deleted' ? 'done' : p.status,
      priority: p.priority,
      size: p.size,
      notes: p.notes || '',
    }));
}
