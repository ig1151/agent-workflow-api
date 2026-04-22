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
  workflow?: string;
  status: 'completed' | 'failed';
  result: unknown;
  steps_executed: string[];
  confidence: number;
  latency_ms: number;
  timestamp: string;
}

async function planWorkflow(goal: string): Promise<{ template: string | null; plan: string[] }> {
  const templateNames = Object.keys(TEMPLATES).join(', ');
  const prompt = `You are an agent orchestrator. Given this goal: "${goal}"
Available templates: ${templateNames}
Return a JSON object with:
{ "template": "best matching template name or null", "plan": ["step1", "step2"] }`;
  const result = await callClaudeJSON(prompt) as { template: string | null; plan: string[] } | null;
  return result ?? { template: null, plan: ['search_web', 'extract_data', 'summarize'] };
}

export async function runWorkflow(
  goal: string,
  input: Record<string, unknown>,
  explicitWorkflow?: string
): Promise<WorkflowResult> {
  const start = Date.now();
  const id = uuidv4();
  const stepsExecuted: string[] = [];
  let result: unknown = null;
  let confidence = 0.8;

  try {
    let template = explicitWorkflow ?? null;

    if (!template) {
      const plan = await planWorkflow(goal);
      template = plan.template;
      stepsExecuted.push('plan_workflow');
    }

    if (template === 'find_and_enrich_leads' || (!template && goal.toLowerCase().includes('lead'))) {
      const query = (input.query as string) ?? goal;
      const limit = (input.limit as number) ?? 5;
      stepsExecuted.push('search_leads');
      const searchResults = await tavilySearch(query + ' companies hiring', 8);
      const content = searchResults.map(r => r.title + ' ' + r.url + ' ' + r.content).join(' ').slice(0, 12000);
      stepsExecuted.push('extract_and_enrich');
      const leads = await callClaudeJSON(`Extract ${limit} company leads from this content for the query "${query}".
Return a JSON array of leads, each with: company, website, industry, location, size, hiring (boolean), signals (array), lead_score (0-100), contact_ready (boolean), contact: { name, email, role }.
Content: ${content}`) as unknown[];
      stepsExecuted.push('score_and_rank');
      confidence = 0.85;
      result = { leads: leads ?? [], count: (leads ?? []).length, query, sources: searchResults.map(r => r.url).slice(0, 5) };

    } else if (template === 'competitive_intelligence' || (!template && goal.toLowerCase().includes('compet'))) {
      const company = (input.company as string) ?? goal;
      stepsExecuted.push('research_company');
      const companyResults = await tavilySearch(company + ' company overview products competitors', 5);
      const competitorResults = await tavilySearch(company + ' competitors alternatives comparison', 5);
      const allContent = [...companyResults, ...competitorResults].map(r => r.title + ' ' + r.content).join(' ').slice(0, 12000);
      stepsExecuted.push('find_competitors');
      stepsExecuted.push('compare');
      const intelligence = await callClaudeJSON(`Research ${company} and its competitors from this content.
Return JSON with: { company: { name, summary, strengths[], weaknesses[] }, competitors: [{ name, summary, strengths[], weaknesses[] }], comparison: { winner: string, reasoning: string } }
Content: ${allContent}`);
      confidence = 0.82;
      result = intelligence ?? { company: { name: company }, competitors: [], comparison: {} };

    } else if (template === 'market_research' || (!template && goal.toLowerCase().includes('market'))) {
      const market = (input.market as string) ?? goal;
      stepsExecuted.push('search_market');
      const marketResults = await tavilySearch(market + ' market size trends opportunities 2024 2025', 8);
      const content = marketResults.map(r => r.title + ' ' + r.content).join(' ').slice(0, 12000);
      stepsExecuted.push('extract_insights');
      stepsExecuted.push('structure_report');
      const report = await callClaudeJSON(`Research the ${market} market from this content.
Return JSON with: { overview: string, market_size: string, key_players: [], trends: [], opportunities: [], risks: [] }
Content: ${content}`);
      confidence = 0.83;
      result = report ?? { overview: `Market research for ${market}`, key_players: [], trends: [], opportunities: [] };

    } else if (template === 'extract_and_structure') {
      const source = (input.source as string) ?? goal;
      const schema = (input.schema as Record<string, string>) ?? {};
      stepsExecuted.push('fetch_content');
      const searchResults = await tavilySearch(source, 5);
      const content = searchResults.map(r => r.title + ' ' + r.content).join(' ').slice(0, 12000);
      stepsExecuted.push('extract_structured_data');
      const extracted = await callClaudeJSON(`Extract structured data from this content matching this schema: ${JSON.stringify(schema)}.
Return only the JSON object with extracted fields plus confidence (0-1) and missing_fields array.
Content: ${content}`);
      confidence = 0.80;
      result = extracted ?? { data: {}, confidence: 0, missing_fields: [] };

    } else {
      stepsExecuted.push('search_web');
      const searchResults = await tavilySearch(goal, 6);
      const content = searchResults.map(r => r.title + ' ' + r.content).join(' ').slice(0, 12000);
      stepsExecuted.push('synthesize');
      const summary = await callClaude(`Complete this goal: "${goal}"\n\nProvide a structured response with summary, key findings, and sources.\n\nContent: ${content}`);
      confidence = 0.75;
      result = { summary, sources: searchResults.map(r => ({ title: r.title, url: r.url })) };
    }

    return {
      id,
      goal,
      workflow: explicitWorkflow ?? template ?? undefined,
      status: 'completed',
      result,
      steps_executed: stepsExecuted,
      confidence,
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Workflow failed';
    return {
      id,
      goal,
      workflow: explicitWorkflow,
      status: 'failed',
      result: { error: message },
      steps_executed: stepsExecuted,
      confidence: 0,
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}
