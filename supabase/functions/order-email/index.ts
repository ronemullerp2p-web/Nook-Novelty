// =========================================================
// Supabase Edge Function: order-email
// Sends a "new order" email via Resend whenever a row is
// inserted into the orders table (triggered by a Database Webhook).
//
// Secrets needed (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY  - from resend.com > API Keys
//   WEBHOOK_SECRET  - any long random text; same value as the
//                     x-webhook-secret header on the webhook
// =========================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const ORDER_EMAIL_TO = Deno.env.get("ORDER_EMAIL_TO") ?? "ronemullerp2p@gmail.com";
const SHOP_NAME = Deno.env.get("SHOP_NAME") ?? "Nook Novelty";
const ADMIN_URL = Deno.env.get("ADMIN_URL") ?? "https://nook-novelty.vercel.app/admin.html";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const money = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(n));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  if (payload.type !== "INSERT" || payload.table !== "orders" || !payload.record) {
    return new Response("Ignored", { status: 200 });
  }

  const o = payload.record;
  const ref = String(o.id).slice(0, 8).toUpperCase();
  const items: Array<{ name: string; qty: number; price: number }> = o.items ?? [];

  const rows = items.map((i) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(i.name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${money(i.price * i.qty)}</td>
    </tr>`).join("");

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;color:#222">
    <h2 style="margin:0 0 4px">New order ${ref}</h2>
    <p style="margin:0 0 16px;color:#666">${new Date(o.created_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>

    <h3 style="margin:16px 0 6px">Customer</h3>
    <p style="margin:0;line-height:1.6">
      ${esc(o.customer_name)}<br>
      <a href="mailto:${esc(o.email)}">${esc(o.email)}</a><br>
      ${o.phone ? esc(o.phone) + "<br>" : ""}
      ${o.address ? esc(o.address).replace(/\n/g, "<br>") : ""}
    </p>

    <h3 style="margin:16px 0 6px">Items</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #ddd">Product</th>
        <th style="padding:6px 8px;border-bottom:2px solid #ddd">Qty</th>
        <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:8px;text-align:right"><strong>Total</strong></td>
        <td style="padding:8px;text-align:right"><strong>${money(o.total)}</strong></td>
      </tr></tfoot>
    </table>

    <p style="margin-top:20px"><a href="${ADMIN_URL}">Open the admin page</a> to manage this order.</p>
    <p style="color:#888;font-size:12px">Reply to this email to contact the customer directly.</p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${SHOP_NAME} <onboarding@resend.dev>`,
      to: [ORDER_EMAIL_TO],
      reply_to: o.email,
      subject: `New order ${ref} – ${money(o.total)} – ${o.customer_name}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Resend error:", text);
    return new Response(text, { status: 500 });
  }
  return new Response("Sent", { status: 200 });
});
