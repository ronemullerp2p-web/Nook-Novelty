// =========================================================
// Supabase Edge Function: order-email  (v2 — order form layout)
// Sends a neatly formatted "new order" email via Resend whenever
// a row is inserted into the orders table (Database Webhook).
//
// Keep "Verify JWT" OFF. Secrets used: RESEND_API_KEY, WEBHOOK_SECRET
// (optional: ORDER_EMAIL_TO, ADMIN_URL)
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const ORDER_EMAIL_TO = Deno.env.get("ORDER_EMAIL_TO") ?? "ronemullerp2p@gmail.com";
const ADMIN_URL = Deno.env.get("ADMIN_URL") ?? "https://nook-novelty.vercel.app/admin#orders";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(n));

// colours
const GREEN = "#1f6f5c";
const LIGHT = "#f4f7f6";
const BORDER = "#e3e1dc";
const MUTED = "#6b6b70";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const payload = await req.json();
  if (payload.type !== "INSERT" || payload.table !== "orders" || !payload.record) {
    return new Response("Ignored");
  }

  // business details for the header (name, logo, contact)
  let biz: Record<string, string> = {};
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } });
    const { data } = await db.from("settings").select("data").eq("id", 1).maybeSingle();
    biz = data?.data || {};
  } catch (_) { /* fall back to defaults */ }
  const shop = biz.business_name || "Nook Novelty";

  const o = payload.record;
  const ref = String(o.id).slice(0, 8).toUpperCase();
  const when = new Date(o.created_at);
  const date = when.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" });
  const time = when.toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" });
  const items: Array<{ name: string; qty: number; price: number }> = o.items ?? [];
  const units = items.reduce((t, i) => t + Number(i.qty), 0);

  const field = (label: string, value: string) => `
    <tr>
      <td style="padding:7px 12px 7px 0;width:130px;color:${MUTED};font-size:13px;vertical-align:top">${label}</td>
      <td style="padding:7px 0;font-size:14px;vertical-align:top">${value || `<span style="color:${MUTED}">—</span>`}</td>
    </tr>`;

  const itemRows = items.map((i, idx) => `
    <tr style="background:${idx % 2 ? LIGHT : "#ffffff"}">
      <td style="padding:10px 12px;font-size:14px;border-bottom:1px solid ${BORDER}">${esc(i.name)}</td>
      <td style="padding:10px 12px;font-size:14px;border-bottom:1px solid ${BORDER};text-align:right;white-space:nowrap">${money(i.price)}</td>
      <td style="padding:10px 12px;font-size:14px;border-bottom:1px solid ${BORDER};text-align:center">${i.qty}</td>
      <td style="padding:10px 12px;font-size:14px;border-bottom:1px solid ${BORDER};text-align:right;white-space:nowrap">${money(i.price * i.qty)}</td>
    </tr>`).join("");

  const sectionTitle = (t: string) =>
    `<div style="font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:${GREEN};margin:0 0 8px">${t}</div>`;

  const html = `
<!doctype html>
<html><body style="margin:0;padding:0;background:#eeeeec">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eeeeec;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#222">

  <!-- HEADER -->
  <tr><td style="background:${GREEN};padding:20px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle">
        ${biz.logo_url ? `<img src="${esc(biz.logo_url)}" alt="${esc(shop)}" height="44" style="display:block;max-height:44px;background:#fff;border-radius:6px;padding:4px;margin-bottom:8px">` : ""}
        <div style="color:#ffffff;font-size:20px;font-weight:bold">${esc(shop)}</div>
        ${biz.tagline ? `<div style="color:#cfe5df;font-size:12px;margin-top:2px">${esc(biz.tagline)}</div>` : ""}
      </td>
      <td style="vertical-align:middle;text-align:right">
        <div style="color:#cfe5df;font-size:11px;letter-spacing:.1em;text-transform:uppercase">Order form</div>
        <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:.04em">#${ref}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- ORDER SUMMARY STRIP -->
  <tr><td style="background:${LIGHT};padding:14px 24px;border-bottom:1px solid ${BORDER}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:12px;color:${MUTED}">Date<br><strong style="font-size:14px;color:#222">${date}</strong></td>
      <td style="font-size:12px;color:${MUTED}">Time<br><strong style="font-size:14px;color:#222">${time}</strong></td>
      <td style="font-size:12px;color:${MUTED}">Items<br><strong style="font-size:14px;color:#222">${units}</strong></td>
      <td style="font-size:12px;color:${MUTED};text-align:right">Status<br>
        <span style="display:inline-block;margin-top:2px;background:#fff4d6;color:#8a5a00;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:99px">NEW</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- CUSTOMER -->
  <tr><td style="padding:22px 24px 6px">
    ${sectionTitle("Customer details")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER}">
      ${field("Name", `<strong>${esc(o.customer_name)}</strong>`)}
      ${field("Email", `<a href="mailto:${esc(o.email)}" style="color:${GREEN}">${esc(o.email)}</a>`)}
      ${field("Phone", o.phone ? `<a href="tel:${esc(o.phone)}" style="color:${GREEN}">${esc(o.phone)}</a>` : "")}
      ${field("Delivery address", o.address ? esc(o.address).replace(/\n/g, "<br>") : "")}
    </table>
  </td></tr>

  <!-- ITEMS -->
  <tr><td style="padding:18px 24px 6px">
    ${sectionTitle("Order items")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:6px;border-collapse:separate;overflow:hidden">
      <tr style="background:${GREEN}">
        <th align="left"  style="padding:9px 12px;font-size:12px;color:#fff;font-weight:bold">Product</th>
        <th align="right" style="padding:9px 12px;font-size:12px;color:#fff;font-weight:bold">Unit price</th>
        <th align="center" style="padding:9px 12px;font-size:12px;color:#fff;font-weight:bold">Qty</th>
        <th align="right" style="padding:9px 12px;font-size:12px;color:#fff;font-weight:bold">Amount</th>
      </tr>
      ${itemRows}
      <tr>
        <td colspan="3" style="padding:12px;text-align:right;font-size:15px;font-weight:bold">Total</td>
        <td style="padding:12px;text-align:right;font-size:17px;font-weight:bold;color:${GREEN};white-space:nowrap">${money(o.total)}</td>
      </tr>
    </table>
  </td></tr>

  <!-- ACTION -->
  <tr><td style="padding:22px 24px 26px" align="center">
    <a href="${ADMIN_URL}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 26px;border-radius:8px">Open order in admin</a>
    <div style="font-size:12px;color:${MUTED};margin-top:12px">Reply to this email to contact ${esc(o.customer_name)} directly.</div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:${LIGHT};padding:14px 24px;border-top:1px solid ${BORDER};font-size:11px;color:${MUTED};text-align:center">
    ${esc(shop)}${biz.phone ? " · " + esc(biz.phone) : ""}${biz.email ? " · " + esc(biz.email) : ""}
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${shop} <onboarding@resend.dev>`,
      to: [ORDER_EMAIL_TO],
      reply_to: o.email,
      subject: `New order #${ref} – ${money(o.total)} – ${o.customer_name}`,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Resend error:", text);
    return new Response(text, { status: 500 });
  }
  return new Response("Sent");
});
