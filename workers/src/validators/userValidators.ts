import { z } from 'zod';

export const userCreateSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  /** Pending invites are only claimed automatically for verified addresses */
  emailVerified: z.boolean().optional(),
});

export type UserCreatePayload = z.infer<typeof userCreateSchema>;
