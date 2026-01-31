import { z } from 'zod';

export const createPropertySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  totalValue: z.number().finite(),
  tokenSupply: z.number().finite(),
  chain: z.string().min(1),
  status: z.enum(['draft', 'funding', 'funded']).optional(),
});

export type CreatePropertyPayload = z.infer<typeof createPropertySchema>;
