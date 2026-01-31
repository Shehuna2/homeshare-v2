import { Router, Request, Response } from 'express';
import { Investment, Property } from '../models/index.js';
import { ContractService } from '../services/contract-service.js';
import { createInvestmentSchema } from '../validators/investments.js';

const router: Router = Router();
const contractService = new ContractService();

const formatMetadata = (metadata: Awaited<ReturnType<ContractService['getPropertyTokenMetadata']>>) => {
  return {
    name: metadata.name,
    symbol: metadata.symbol,
    decimals: metadata.decimals.toString(),
    totalSupply: metadata.totalSupply.toString(),
    propertyId: metadata.propertyId,
    totalValue: metadata.totalValue.toString(),
  };
};

// GET /api/investments - List user investments
router.get('/', async (req: Request, res: Response) => {
  try {
    const investor = req.query.investor?.toString();
    const investments = await Investment.findAll({
      where: investor ? { investor } : undefined,
      order: [['createdAt', 'DESC']],
    });
    const enriched = await Promise.all(
      investments.map(async (investment) => {
        const data = investment.toJSON();
        try {
          const metadata = await contractService.getPropertyTokenMetadata(investment.chain);
          return { ...data, contractMetadata: formatMetadata(metadata) };
        } catch (metadataError) {
          return { ...data, contractMetadata: null };
        }
      })
    );
    res.json({ investments: enriched });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
});

// POST /api/investments - Record new investment
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createInvestmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid investment payload' });
    }

    const { propertyId, investor, amount, tokenAmount, chain } = parsed.data;

    const property = await Property.findByPk(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const investment = await Investment.create({
      propertyId,
      investor,
      amount,
      tokenAmount,
      chain,
    });

    res.status(201).json({ investment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record investment' });
  }
});

export default router;
