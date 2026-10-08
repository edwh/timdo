import { z } from 'zod';

export const epicStatusEnum = z.enum(['active', 'completed', 'on_hold']);

export const epicCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  projectId: z.string().optional(),
  status: epicStatusEnum.default('active'),
});

export type EpicCreateInput = z.input<typeof epicCreateSchema>;
export type EpicCreatePayload = z.infer<typeof epicCreateSchema>;

export const epicUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  projectId: z.string().optional(),
  status: epicStatusEnum.optional(),
});

export type EpicUpdatePayload = z.infer<typeof epicUpdateSchema>;
