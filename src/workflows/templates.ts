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
