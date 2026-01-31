import { z } from 'zod';

export const loginSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  message: z.string().min(1),
  role: z.enum(['owner', 'investor']).optional(),
});

export type LoginPayload = z.infer<typeof loginSchema>;
