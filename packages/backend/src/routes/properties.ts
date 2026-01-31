import { Router, Request, Response } from 'express';
import { Property } from '../models/index.js';

const router: Router = Router();

// GET /api/properties - List all properties
router.get('/', async (req: Request, res: Response) => {
  try {
    const properties = await Property.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ properties });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// GET /api/properties/:id - Get property details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const property = await Property.findByPk(id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({ property });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// POST /api/properties - Create new property
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, location, description, totalValue, tokenSupply, chain, status } = req.body;

    if (!name || !location || !description || totalValue === undefined || tokenSupply === undefined || !chain) {
      return res.status(400).json({ error: 'Missing required property fields' });
    }

    const parsedTotalValue = Number(totalValue);
    const parsedTokenSupply = Number(tokenSupply);

    if (!Number.isFinite(parsedTotalValue) || !Number.isFinite(parsedTokenSupply)) {
      return res.status(400).json({ error: 'Invalid numeric values for totalValue or tokenSupply' });
    }

    const property = await Property.create({
      name,
      location,
      description,
      totalValue: parsedTotalValue,
      tokenSupply: parsedTokenSupply,
      chain,
      status: status ?? 'draft',
    });

    res.status(201).json({ property });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create property' });
  }
});

export default router;
