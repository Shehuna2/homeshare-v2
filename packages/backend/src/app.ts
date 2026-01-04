import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import propertiesRouter from './routes/properties.js';
import investmentsRouter from './routes/investments.js';
import authRouter from './routes/auth.js';
import chainsRouter from './routes/chains.js';
import tokensRouter from './routes/tokens.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/properties', propertiesRouter);
app.use('/api/investments', investmentsRouter);
app.use('/api/auth', authRouter);
app.use('/api/chains', chainsRouter);
app.use('/api/tokens', tokensRouter);

// Error handling
app.use(errorHandler);

export default app;
