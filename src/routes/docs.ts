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
