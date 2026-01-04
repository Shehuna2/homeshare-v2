import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/tokens - List tokens by chain
router.get('/', async (req: Request, res: Response) => {
  try {
    const { chainId } = req.query;
    // TODO: Implement token listing logic
    res.json({ tokens: [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

export default router;
