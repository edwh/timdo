import { z } from 'zod';

export const userCreateSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  /** Pending invites are only claimed automatically for verified addresses */
  emailVerified: z.boolean().optional(),
});

export type UserCreatePayload = z.infer<typeof userCreateSchema>;

export const tokenCreateSchema = z.object({
  name: z.string().trim().min(1, 'Give the token a name, e.g. "Laptop CLI"').max(60),
});
