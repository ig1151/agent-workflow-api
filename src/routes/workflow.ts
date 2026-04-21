import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { runWorkflow } from '../workflows/runner';
import { TEMPLATES } from '../workflows/templates';
import { logger } from '../logger';

const router = Router();

const schema = Joi.object({
  goal: Joi.string().min(5).max(500).required(),
  input: Joi.object().default({}),
  template: Joi.string().optional(),
});

router.post('/workflow/run', async (req: Request, res: Response) => {
  const { error, value } = schema.validate(req.body);
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details[0].message });
    return;
  }

  logger.info({ goal: value.goal }, 'Workflow started');

  try {
    const result = await runWorkflow(value.goal, value.input ?? {});
    logger.info({ goal: value.goal, status: result.status, latency_ms: result.latency_ms }, 'Workflow complete');
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Workflow failed';
    logger.error({ goal: value.goal, err }, 'Workflow failed');
    res.status(500).json({ error: 'Workflow failed', details: message });
  }
});

router.get('/workflow/templates', (_req: Request, res: Response) => {
  const templates = Object.values(TEMPLATES).map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
    output_schema: t.output_schema,
    steps: t.steps,
  }));
  res.json({ templates, count: templates.length });
});

export default router;
