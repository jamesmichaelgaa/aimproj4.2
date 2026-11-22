import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Ingest-Key",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CATEGORY_KEYWORDS: Array<[string, RegExp]> = [
  ["Groceries", /grocer|supermarket|whole foods|trader joe|safeway|kroger|aldi|costco|walmart|market/i],
  ["Dining", /restaurant|cafe|coffee|starbucks|pizza|burger|doordash|ubereats|uber eats|grubhub|bar\b|diner|sushi/i],
  ["Transport", /uber|lyft|taxi|fuel|gas station|shell|chevron|parking|metro|transit|train|airline|airways|toll/i],
  ["Shopping", /amazon|target|best buy|ebay|etsy|apparel|clothing|store|shop/i],
  ["Bills", /electric|water bill|internet|phone bill|utility|insurance|rent|mortgage|verizon|at&t|comcast|netflix|spotify/i],
  ["Entertainment", /cinema|movie|theat|concert|ticket|steam|playstation|xbox|game/i],
  ["Health", /pharmacy|cvs|walgreens|clinic|doctor|dental|gym|fitness|hospital/i],
];

function parseAmountCents(text: string): number | null {
  const currency = text.match(/(?:\$|USD\s?|€|£)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/i);
  const fallback = currency ?? text.match(/(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})\b/);
  if (!fallback) return null;
  const whole = Number(fallback[1].replace(/,/g, ""));
  const cents = fallback[2] ? Number(fallback[2].padEnd(2, "0")) : 0;
  const total = whole * 100 + cents;
  return total > 0 ? total : null;
}

function parseMerchant(text: string): string | null {
  const match = text.match(
    /\b(?:at|to|from|with|merchant:?)\s+([A-Za-z0-9&'.\- ]{2,40}?)(?=\s+(?:on|for|using|ending|card|with|at)\b|[.,;\n]|$)/i,
  );
  const merchant = match?.[1]?.trim().replace(/[.\-]+$/, "");
  return merchant && merchant.length >= 2 ? merchant : null;
}

function guessCategoryName(text: string): string | null {
  for (const [name, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

async function readPayload(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    return Object.fromEntries(
      Object.entries(body ?? {}).map(([k, v]) => [k.toLowerCase(), typeof v === "string" ? v : String(v ?? "")]),
    );
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key.toLowerCase()] = value;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Use POST to send a notification." }, 405);
    }

    const url = new URL(req.url);
    const providedKey = req.headers.get("x-ingest-key") ?? url.searchParams.get("key") ?? "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (!providedKey) {
      return json({ error: "Invalid ingest key." }, 401);
    }

    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("ingest_key", providedKey)
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!settings) {
      return json({ error: "Invalid ingest key." }, 401);
    }
    const userId: string = settings.user_id;

    const payload = await readPayload(req);
    const subject = payload.subject ?? "";
    const text = [
      payload.text,
      payload.body,
      payload["body-plain"],
      payload["stripped-text"],
      payload.plain,
      payload.html,
      subject,
    ]
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      return json({ error: "No notification text was received." }, 400);
    }

    const amountCents = parseAmountCents(text);
    if (amountCents === null) {
      return json({ error: "Could not find an amount in this notification." }, 422);
    }

    const merchant = parseMerchant(text) ?? (subject.trim() || "Unknown merchant");
    const categoryName = guessCategoryName(text);

    let categoryId: string | null = null;
    if (categoryName) {
      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .eq("name", categoryName)
        .maybeSingle();
      if (categoryError) throw categoryError;
      categoryId = category?.id ?? null;
    }

    const source = (payload.from ?? "").includes("@") || payload.source === "email" ? "email" : "sms";

    const { data: expense, error: insertError } = await supabase
      .from("expenses")
      .insert({
        user_id: userId,
        merchant: merchant.slice(0, 80),
        amount_cents: amountCents,
        category_id: categoryId,
        source,
        raw_text: text.slice(0, 2000),
      })
      .select("id, merchant, amount_cents, occurred_on")
      .single();

    if (insertError) throw insertError;

    return json({ ok: true, expense });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json({ error: message }, 500);
  }
});
