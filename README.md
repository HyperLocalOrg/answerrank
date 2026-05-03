# AnswerRank

AI Search Visibility Audit for Amazon and ecommerce brands.

AnswerRank answers a simple operator question:

> SEO tells you how you rank on Google. AnswerRank tells ecommerce brands whether AI assistants recommend their product, why competitors win, and exactly what to fix.

## Problem

Amazon and Shopify sellers already optimize product pages for marketplace search, but shoppers increasingly ask AI assistants what to buy. Brands do not know whether they appear in those answers, which competitors are recommended instead, or what content gaps make them less recommendable.

## Solution

AnswerRank runs an AI visibility audit for a product and buyer-intent query. It compares model responses, extracts buyer criteria, scores the product, and turns the diagnosis into listing improvements.

The main user flow asks whether the seller has a product URL. If yes, they paste the URL. If not, they enter brand and product name. Category and competitors are inferred from the query, scraped page, and AI model responses.

The product is designed for ecommerce operators, not researchers. The output is an executive report with:

- Overall AEO score
- Model-by-model visibility
- Competitor visibility table
- Ranking comparison against inferred competitors
- Buyer criteria coverage
- Missing trust signals
- Prioritized optimization roadmap
- Generated Amazon-style title, bullets, FAQ, and description
- Raw AI evidence for trust

## APIs And Tools

Live mode supports:

- OpenAI API for model visibility analysis
- Gemini API for a second AI engine perspective
- Groq API for a low-cost Llama-based second model
- Firecrawl API for product page scraping
- Supabase for saved shareable reports
- Vercel serverless functions for secure API calls

Demo mode runs without API keys, so evaluators can use the product immediately.

## Lightweight ML

This MVP does not train a custom model. That is intentional.

Instead, it uses lightweight ML-style analysis:

- LLM-as-judge extraction for model answers
- Semantic coverage scoring between buyer criteria and listing copy
- Deterministic AEO scoring in code

Custom model training would require clean historical recommendation data and would not improve the first product experience enough for this stage.

## Scoring Methodology

The AEO score is calculated as:

```txt
25% Mention Visibility
20% Ranking Position
20% Trust Signal Coverage
15% Competitive Differentiation
10% Sentiment / Recommendation Strength
10% Content Readiness
```

The scoring is transparent so a seller can understand not just the score, but what to change.

## Research Inspiration

- GEO: Generative Engine Optimization, KDD 2024
- RAGAS evaluation concepts: answer relevance, context relevance, faithfulness
- LLM recommender systems research around AI-mediated product discovery

## Demo Scenario

The built-in demo uses:

- Query: `best magnesium supplement for seniors`
- Product: `CalmLeaf Magnesium Glycinate 200mg`
- Competitors: `Nature Made`, `Doctor's Best`, `Pure Encapsulations`, `NOW Foods`

This category is useful for demonstration because AI assistants naturally evaluate safety, dosage, magnesium form, digestive tolerance, reviews, and third-party testing.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Build:

```bash
npm run build
```

For local demo mode, `npm run dev` is enough.

For local live API testing, use Vercel's local runtime:

```bash
npm i -g vercel
vercel dev
```

## Environment Variables

Create environment variables in Vercel for live API mode:

```txt
OPENAI_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
FIRECRAWL_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Optional model overrides:

```txt
OPENAI_MODEL=gpt-4o-mini
GEMINI_MODEL=gemini-1.5-flash
GROQ_MODEL=llama-3.1-8b-instant
```

For a near-free deployment, use `GEMINI_API_KEY` + `GROQ_API_KEY` and leave `OPENAI_API_KEY` empty. Do not expose LLM keys as `VITE_` browser variables in production. Live mode calls `/api/audit`, and the serverless function calls Gemini, Groq, optional OpenAI, Firecrawl, and Supabase securely.

## Low-Cost Production Setup

Use this setup for the public submission:

```txt
Vercel
  - hosts the React/Vite app
  - runs /api/audit and /api/report as serverless functions

Supabase
  - stores generated report JSON
  - enables short share links like /?reportId=<uuid>

Gemini
  - primary low-cost model, default gemini-1.5-flash

Groq
  - secondary low-cost Llama model, default llama-3.1-8b-instant

OpenAI
  - optional model for stronger analysis, default gpt-4o-mini

Firecrawl
  - scrapes product pages when a URL is provided
  - app still works with pasted product copy if scraping fails
```

## Supabase Setup

1. Create a free Supabase project.
2. Open the SQL editor.
3. Run the SQL in `supabase.sql`.
4. Copy these values into Vercel environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

The service role key is used only in Vercel serverless functions. Never put it in frontend code.

## Deploy To Vercel

1. Push this project to GitHub.
2. Import the repo in Vercel.
3. Set framework preset to `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add the environment variables listed above.
7. Deploy.

After deployment:

- Demo mode works even without API keys.
- Live mode calls `/api/audit`.
- Saved reports are loaded through `/api/report?id=<uuid>`.
- The Share button copies a short saved-report URL when Supabase saving succeeds.
- Repeated identical live audits reuse a cached Supabase report for 12 hours.
- The report header shows `Cache hit`, `Cache miss`, `Demo report`, or `Shared saved report`.
- `Run fresh` bypasses the cache and creates a new live audit.

## Roadmap

- Weekly AI visibility tracking
- Rufus-style Amazon shopping assistant simulation
- Shopify/Amazon listing integration
- Competitor monitoring
- PDF reports
- Email alerts
- Team workspaces
- Go backend if the product outgrows Vercel serverless functions

## Video Pitch

The product is not “I queried some LLMs.”

The product is:

> Amazon sellers are optimizing for search results, but product discovery is moving into AI-generated answers. AnswerRank shows whether AI recommends your product, why competitors win, and gives you a practical roadmap to become more recommendable.
