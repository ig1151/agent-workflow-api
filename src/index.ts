import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from './logger';
import workflowRouter from './routes/workflow';
import docsRouter from './routes/docs';
import openapiRouter from './routes/openapi';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }));

app.get('/', (_req, res) => {
  res.json({
    service: 'agent-workflow-api',
    version: '1.0.0',
    description: 'Goal-driven agent workflow API — describe what you want, get a structured result.',
    status: 'ok',
    docs: '/docs',
    health: '/v1/health',
    endpoints: {
      run_workflow: 'POST /v1/workflow/run',
      list_templates: 'GET /v1/workflow/templates',
    },
    example: {
      goal: 'Find AI startups in San Francisco that are hiring',
      input: { query: 'AI startups San Francisco hiring', limit: 5 },
    },
  });
});

app.get('/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agent-workflow-api', timestamp: new Date().toISOString() });
});

app.use('/v1', workflowRouter);
app.use('/docs', docsRouter);
app.use('/openapi.json', openapiRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Agent Workflow API running');
});
