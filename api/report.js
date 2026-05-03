export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET /api/report?id=..." });

  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ error: "Missing report id" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Supabase is not configured" });
  }

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reports?id=eq.${encodeURIComponent(id)}&select=report`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) return res.status(response.status).json({ error: "Could not load report" });

  const rows = await response.json();
  if (!rows.length) return res.status(404).json({ error: "Report not found" });

  return res.status(200).json({ report: rows[0].report });
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
