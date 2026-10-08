import { z } from 'zod';

export const goalTypeEnum = z.enum(['aim', 'focus', 'value', 'housekeeping']);

export const goalCreateSchema = z.object({
  type: goalTypeEnum,
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  orderIndex: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type GoalCreateInput = z.input<typeof goalCreateSchema>;
export type GoalCreatePayload = z.infer<typeof goalCreateSchema>;

export const goalUpdateSchema = z.object({
  type: goalTypeEnum.optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  orderIndex: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type GoalUpdatePayload = z.infer<typeof goalUpdateSchema>;
