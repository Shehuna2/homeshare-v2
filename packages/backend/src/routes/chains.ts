import { Router, Request, Response } from 'express';

const router: Router = Router();

// GET /api/chains - List supported chains
router.get('/', async (req: Request, res: Response) => {
  try {
    const chains = [
      { id: 1, name: 'Ethereum', symbol: 'ETH' },
      { id: 8453, name: 'Base', symbol: 'ETH' },
      { id: 9000, name: 'Canton', symbol: 'CC' },
    ];
    res.json({ chains });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chains' });
  }
});

export default router;
