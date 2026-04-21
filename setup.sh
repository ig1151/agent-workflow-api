#!/bin/bash
set -e

echo "🚀 Setting up Agent Workflow API..."

mkdir -p src/routes src/workflows src/executors

cat > package.json << 'ENDPACKAGE'
{
  "name": "agent-workflow-api",
  "version": "1.0.0",
  "description": "Goal-driven agent workflow API — describe what you want, get a structured result.",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "joi": "^17.11.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/compression": "^1.7.5",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.7",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.2"
  }
}
ENDPACKAGE

cat > tsconfig.json << 'ENDTSCONFIG'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
ENDTSCONFIG

cat > render.yaml << 'ENDRENDER'
services:
  - type: web
    name: agent-workflow-api
    env: node
    buildCommand: npm install && npm run build
    startCommand: node dist/index.js
    healthCheckPath: /v1/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: TAVILY_API_KEY
        sync: false
ENDRENDER

cat > .gitignore << 'ENDGITIGNORE'
node_modules/
dist/
.env
*.log
ENDGITIGNORE

cat > src/logger.ts << 'ENDLOGGER'
export const logger = {
  info: (obj: unknown, msg?: string) =>
    console.log(JSON.stringify({ level: 'info', ...(typeof obj === 'object' ? obj : { data: obj }), msg })),
  warn: (obj: unknown, msg?: string) =>
    console.warn(JSON.stringify({ level: 'warn', ...(typeof obj === 'object' ? obj : { data: obj }), msg })),
  error: (obj: unknown, msg?: string) =>
    console.error(JSON.stringify({ level: 'error', ...(typeof obj === 'object' ? obj : { data: obj }), msg })),
};
ENDLOGGER

cat > src/workflows/templates.ts << 'ENDTEMPLATES'
export interface WorkflowTemplate {
  name: string;
  description: string;
  input_schema: Record<string, string>;
  output_schema: Record<string, string>;
  steps: string[];
}

export const TEMPLATES: Record<string, WorkflowTemplate> = {
  find_and_enrich_leads: {
    name: 'find_and_enrich_leads',
    description: 'Discover companies matching a query, enrich each with industry and tech stack data',
    input_schema: { query: 'string', limit: 'number (optional, default 5)' },
    output_schema: { leads: 'array of enriched lead objects', count: 'number' },
    steps: ['search_leads', 'enrich_companies', 'score_and_rank'],
  },
  research_and_summarize: {
    name: 'research_and_summarize',
    description: 'Deep research any topic and return a structured summary with key facts and sources',
    input_schema: { topic: 'string', focus: 'string (optional)' },
    output_schema: { summary: 'string', key_facts: 'array', sources: 'array' },
    steps: ['web_search', 'extract_content', 'synthesize_summary'],
  },
  extract_and_structure: {
    name: 'extract_and_structure',
    description: 'Fetch a URL or search query and extract structured data matching a schema',
    input_schema: { source: 'string (url or search query)', schema: 'object (field definitions)' },
    output_schema: { data: 'object matching schema', confidence: 'number', missing_fields: 'array' },
    steps: ['fetch_content', 'extract_structured_data'],
  },
  competitive_intelligence: {
    name: 'competitive_intelligence',
    description: 'Research a company and its top competitors, return a comparison',
    input_schema: { company: 'string', focus: 'string (optional)' },
    output_schema: { company: 'object', competitors: 'array', comparison: 'object' },
    steps: ['research_company', 'find_competitors', 'compare'],
  },
  market_research: {
    name: 'market_research',
    description: 'Research a market or industry and return size, trends, key players and opportunities',
    input_schema: { market: 'string', region: 'string (optional)' },
    output_schema: { overview: 'string', key_players: 'array', trends: 'array', opportunities: 'array' },
    steps: ['search_market', 'extract_insights', 'structure_report'],
  },
};
ENDTEMPLATES

cat > src/executors/anthropic.ts << 'ENDANTHRO'
import axios from 'axios';

export async function callClaude(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return res.data.content[0]?.text ?? '';
}

export async function callClaudeJSON(prompt: string, maxTokens = 2000): Promise<unknown> {
  const text = await callClaude(prompt + '\n\nReturn only valid JSON, no markdown.', maxTokens);
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}
ENDANTHRO

cat > src/executors/tavily.ts << 'ENDTAVILY'
import axios from 'axios';

export async function tavilySearch(query: string, maxResults = 5): Promise<Array<{ title: string; url: string; content: string }>> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not set');

  const res = await axios.post(
    'https://api.tavily.com/search',
    { query, max_results: maxResults, search_depth: 'basic' },
    {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );

  return (res.data.results ?? []).map((r: { title: string; url: string; content?: string }) => ({
    title: r.title,
    url: r.url,
    content: r.content ?? '',
  }));
}
ENDTAVILY

cat > src/workflows/runner.ts << 'ENDRUNNER'
import { v4 as uuidv4 } from 'uuid';
import { callClaude, callClaudeJSON } from '../executors/anthropic';
import { tavilySearch } from '../executors/tavily';
import { TEMPLATES } from './templates';

export interface WorkflowStep {
  step: string;
  status: 'completed' | 'failed' | 'skipped';
  output?: unknown;
}

export interface WorkflowResult {
  id: string;
  goal: string;
  template?: string;
  status: 'completed' | 'failed';
  result: unknown;
  steps: WorkflowStep[];
  latency_ms: number;
  timestamp: string;
}

async function planWorkflow(goal: string): Promise<{ template: string | null; plan: string[] }> {
  const templateNames = Object.keys(TEMPLATES).join(', ');
  const prompt = `You are an agent orchestrator. Given this goal: "${goal}"

Available templates: ${templateNames}

Return a JSON object with:
{
  "template": "best matching template name or null if none fits",
  "plan": ["step1", "step2", "step3"]
}

Steps should be concise action names like: search_web, extract_data, research_company, find_leads, summarize, compare, enrich.`;

  const result = await callClaudeJSON(prompt) as { template: string | null; plan: string[] } | null;
  return result ?? { template: null, plan: ['search_web', 'extract_data', 'summarize'] };
}

export async function runWorkflow(
  goal: string,
  input: Record<string, unknown>
): Promise<WorkflowResult> {
  const start = Date.now();
  const id = uuidv4();
  const steps: WorkflowStep[] = [];
  let result: unknown = null;

  try {
    // Step 1 — plan
    const { template, plan } = await planWorkflow(goal);
    steps.push({ step: 'plan_workflow', status: 'completed', output: { template, plan } });

    // Step 2 — execute based on template or free-form
    const templateDef = template ? TEMPLATES[template] : null;

    if (template === 'find_and_enrich_leads' || plan.some(p => p.includes('lead'))) {
      const query = (input.query as string) ?? goal;
      const limit = (input.limit as number) ?? 5;

      steps.push({ step: 'search_leads', status: 'completed' });

      const searchResults = await tavilySearch(`${query} companies hiring`, 8);
      const content = searchResults.map(r => r.title + ' ' + r.url + ' ' + r.content).join(' ').slice(0, 12000);

      const leads = await callClaudeJSON(`Extract ${limit} company leads from this content for the query "${query}".
Return a JSON array of leads, each with: company, website, industry, location, size, hiring (boolean), signals (array), lead_score (0-100), contact_ready (boolean).
Content: ${content}`) as unknown[];

      steps.push({ step: 'enrich_and_score', status: 'completed' });
      result = { leads: leads ?? [], count: (leads ?? []).length, query, sources: searchResults.map(r => r.url).slice(0, 5) };

    } else if (template === 'competitive_intelligence' || plan.some(p => p.includes('compet'))) {
      const company = (input.company as string) ?? goal;

      steps.push({ step: 'research_company', status: 'completed' });
      const companyResults = await tavilySearch(`${company} company overview products competitors`, 5);
      const competitorResults = await tavilySearch(`${company} competitors alternatives comparison`, 5);

      const allContent = [...companyResults, ...competitorResults]
        .map(r => r.title + ' ' + r.content).join(' ').slice(0, 12000);

      steps.push({ step: 'compare_competitors', status: 'completed' });
      const intelligence = await callClaudeJSON(`Research ${company} and its competitors from this content.
Return JSON with: { company: { name, summary, strengths[], weaknesses[] }, competitors: [{ name, summary, strengths[], weaknesses[] }], comparison: { winner: string, reasoning: string } }
Content: ${allContent}`);

      result = intelligence ?? { company: { name: company }, competitors: [], comparison: {} };

    } else if (template === 'market_research' || plan.some(p => p.includes('market'))) {
      const market = (input.market as string) ?? goal;

      steps.push({ step: 'search_market', status: 'completed' });
      const marketResults = await tavilySearch(`${market} market size trends opportunities 2024 2025`, 8);
      const content = marketResults.map(r => r.title + ' ' + r.content).join(' ').slice(0, 12000);

      steps.push({ step: 'extract_insights', status: 'completed' });
      const report = await callClaudeJSON(`Research the ${market} market from this content.
Return JSON with: { overview: string, market_size: string, key_players: [], trends: [], opportunities: [], risks: [] }
Content: ${content}`);

      result = report ?? { overview: `Market research for ${market}`, key_players: [], trends: [], opportunities: [] };

    } else {
      // Free-form goal — search + summarize
      steps.push({ step: 'search_web', status: 'completed' });
      const searchResults = await tavilySearch(goal, 6);
      const content = searchResults.map(r => r.title + ' ' + r.content).join(' ').slice(0, 12000);

      steps.push({ step: 'synthesize', status: 'completed' });
      const summary = await callClaude(`Based on these search results, complete this goal: "${goal}"

Provide a clear, structured response with:
- A summary answering the goal
- Key findings (bullet points)
- Sources used

Search results: ${content}`);

      result = {
        summary,
        sources: searchResults.map(r => ({ title: r.title, url: r.url })),
      };
    }

    return {
      id,
      goal,
      template: template ?? undefined,
      status: 'completed',
      result,
      steps,
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Workflow failed';
    steps.push({ step: 'error', status: 'failed', output: { error: message } });
    return {
      id,
      goal,
      status: 'failed',
      result: { error: message },
      steps,
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}
ENDRUNNER

cat > src/routes/workflow.ts << 'ENDWORKFLOW'
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
ENDWORKFLOW

cat > src/routes/docs.ts << 'ENDDOCS'
import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Agent Workflow API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; background: #0f0f0f; color: #e0e0e0; }
    h1 { color: #7c3aed; } h2 { color: #a78bfa; border-bottom: 1px solid #333; padding-bottom: 8px; }
    pre { background: #1a1a1a; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
    code { color: #c084fc; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; margin-right: 8px; color: white; }
    .post { background: #7c3aed; } .get { background: #065f46; }
    table { width: 100%; border-collapse: collapse; } td, th { padding: 8px 12px; border: 1px solid #333; text-align: left; }
    th { background: #1a1a1a; }
  </style>
</head>
<body>
  <h1>Agent Workflow API</h1>
  <p>Goal-driven agent workflow API — describe what you want, get a structured result.</p>
  <h2>Endpoints</h2>
  <table>
    <tr><th>Method</th><th>Path</th><th>Description</th></tr>
    <tr><td><span class="badge post">POST</span></td><td>/v1/workflow/run</td><td>Run a goal-based workflow</td></tr>
    <tr><td><span class="badge get">GET</span></td><td>/v1/workflow/templates</td><td>List available workflow templates</td></tr>
    <tr><td><span class="badge get">GET</span></td><td>/v1/health</td><td>Health check</td></tr>
  </table>
  <h2>Example</h2>
  <pre>POST /v1/workflow/run
{
  "goal": "Find AI startups in San Francisco that are hiring",
  "input": { "query": "AI startups San Francisco hiring", "limit": 5 }
}</pre>
  <h2>Templates</h2>
  <ul>
    <li><code>find_and_enrich_leads</code> — Discover and enrich company leads</li>
    <li><code>research_and_summarize</code> — Deep research any topic</li>
    <li><code>extract_and_structure</code> — Fetch and extract structured data</li>
    <li><code>competitive_intelligence</code> — Research company and competitors</li>
    <li><code>market_research</code> — Research a market or industry</li>
  </ul>
  <p><a href="/openapi.json" style="color:#a78bfa">OpenAPI JSON</a></p>
</body>
</html>`);
});

export default router;
ENDDOCS

cat > src/routes/openapi.ts << 'ENDOPENAPI'
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
ENDOPENAPI

cat > src/index.ts << 'ENDINDEX'
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
ENDINDEX

echo "✅ All files created!"
echo "Next: npm install && npm run dev"