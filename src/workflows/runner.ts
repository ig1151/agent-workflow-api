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
