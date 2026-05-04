export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET /api/recent" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ recent: [] });
  }

  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    select: "id,brand_name,product_name,target_query,created_at",
    order: "created_at.desc",
    limit: "5",
    created_at: `gte.${cutoff}`,
  });

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reports?${params}`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );

    if (!response.ok) return res.status(200).json({ recent: [] });

    const rows = await response.json();
    const recent = rows.map((row) => ({
      product: row.product_name || row.brand_name || "Unknown product",
      brandName: row.brand_name || undefined,
      productName: row.product_name || undefined,
      query: row.target_query || "",
      createdAt: new Date(row.created_at).getTime(),
    }));

    return res.status(200).json({ recent });
  } catch {
    return res.status(200).json({ recent: [] });
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
