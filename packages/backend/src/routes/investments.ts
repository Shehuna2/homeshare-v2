import { Router, Request, Response } from 'express';
import { createInvestment, listInvestments, getPropertyById } from '../services/data-store.js';

const router: Router = Router();

// GET /api/investments - List user investments
router.get('/', async (req: Request, res: Response) => {
  try {
    const investor = req.query.investor?.toString();
    const investments = listInvestments(investor);
    res.json({ investments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
});

// POST /api/investments - Record new investment
router.post('/', async (req: Request, res: Response) => {
  try {
    const { propertyId, investor, amount, tokenAmount, chain } = req.body;

    if (!propertyId || !investor || amount === undefined || tokenAmount === undefined || !chain) {
      return res.status(400).json({ error: 'Missing required investment fields' });
    }

    const property = getPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const parsedAmount = Number(amount);
    const parsedTokenAmount = Number(tokenAmount);

    if (!Number.isFinite(parsedAmount) || !Number.isFinite(parsedTokenAmount)) {
      return res.status(400).json({ error: 'Invalid numeric values for amount or tokenAmount' });
    }

    const investment = createInvestment({
      propertyId,
      investor,
      amount: parsedAmount,
      tokenAmount: parsedTokenAmount,
      chain,
    });

    res.status(201).json({ investment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record investment' });
  }
});

export default router;
