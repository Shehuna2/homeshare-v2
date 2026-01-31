import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { env } from '../config/env.js';
import { auth, AuthenticatedRequest } from '../middleware/auth.js';
import { loginSchema } from '../validators/auth.js';

const router: Router = Router();

// POST /api/auth/login - Web3 wallet login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid login payload' });
    }

    const { address, signature, message, role } = parsed.data;

    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const [user] = await User.findOrCreate({
      where: { address: address.toLowerCase() },
      defaults: { role: role === 'owner' ? 'owner' : 'investor' },
    });

    if (role === 'owner' && user.role !== 'owner') {
      user.role = 'owner';
      await user.save();
    }

    const token = jwt.sign(
      { id: user.id, address: user.address, role: user.role },
      env.jwtSecret,
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.json({ token, user });
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/verify - Verify JWT token
router.post('/verify', auth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ valid: true, user: req.user });
});

export default router;
