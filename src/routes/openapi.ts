import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'Agent Workflow API',
      version: '1.0.0',
      description: 'Goal-driven agent workflow API — describe what you want, get a structured result.',
    },
    servers: [{ url: 'https://agent-workflow-api.onrender.com' }],
    paths: {
      '/v1/workflow/run': {
        post: {
          summary: 'Run a goal-based workflow',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['goal'],
                  properties: {
                    goal: { type: 'string' },
                    input: { type: 'object' },
                    template: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Workflow result with steps and output' } },
        },
      },
      '/v1/workflow/templates': {
        get: { summary: 'List workflow templates', responses: { '200': { description: 'Template list' } } },
      },
      '/v1/health': {
        get: { summary: 'Health check', responses: { '200': { description: 'OK' } } },
      },
    },
  });
});

export default router;
