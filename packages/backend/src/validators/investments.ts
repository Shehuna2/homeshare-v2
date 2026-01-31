import { z } from 'zod';

export const createInvestmentSchema = z.object({
  propertyId: z.string().min(1),
  investor: z.string().min(1),
  amount: z.number().finite(),
  tokenAmount: z.number().finite(),
  chain: z.string().min(1),
});

export type CreateInvestmentPayload = z.infer<typeof createInvestmentSchema>;
