/* =========================================================
   Nook & Novelty — Custom Design renderer
   Shared by admin.html (the designer + preview) and the
   send-invoice function (the real invoice PDF), so what you
   design is exactly what customers get.
   All positions and sizes are in PDF points (A4 = 595 x 842).
   ========================================================= */
function createDesignRender() {
  const W = 595.28, H = 841.89;
  const uid = () => Math.random().toString(36).slice(2, 10);

  // ---------- merge fields ----------
  const FIELDS = [
    { group: "Business details", items: [
      ["business_name", "Business name"], ["tagline", "Tagline"], ["business_address", "Address"],
      ["business_phone", "Phone"], ["business_whatsapp", "WhatsApp"], ["business_email", "Email"],
      ["business_website", "Website"], ["reg_no", "Company reg. no."], ["vat_no", "VAT no."],
    ] },
    { group: "Invoice", items: [
      ["invoice_no", "Invoice no."], ["invoice_date", "Invoice date"], ["order_date", "Order date"],
      ["order_ref", "Order number"], ["status", "Order status"],
    ] },
    { group: "Customer", items: [
      ["customer_name", "Name"], ["customer_email", "Email"], ["customer_phone", "Phone"], ["customer_address", "Delivery address"],
    ] },
    { group: "Totals", items: [
      ["total", "Total"], ["amount_due", "Amount due"], ["paid_amount", "Amount paid"], ["item_count", "Number of items"],
    ] },
    { group: "Payment (from Business Details)", items: [
      ["bank_name", "Bank"], ["account_name", "Account holder"], ["account_number", "Account number"],
      ["branch_code", "Branch code"], ["account_type", "Account type"], ["payment_reference", "Payment reference"],
      ["payment_note", "Payment note"],
    ] },
    { group: "Page (footer)", items: [["page", "Page number"], ["pages", "Number of pages"], ["today", "Today's date"]] },
  ];

  const money = (n) => "R " + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const longDate = (d) => new Date(d).toLocaleDateString("en-ZA",
    { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric" });
  const STATUS = { new: "New", invoiced: "Invoiced", paid: "Paid", shipped: "Shipped", completed: "Completed", cancelled: "Cancelled" };
  const isPaid = (s) => ["paid", "shipped", "completed"].includes(s);

  const SAMPLE_ORDER = {
    id: "8ff351af-0000-0000-0000-000000000000", created_at: new Date().toISOString(),
    customer_name: "Sample Customer", email: "customer@example.com", phone: "082 123 4567",
    address: "12 Example Street\nCenturion, 0157", status: "invoiced",
    items: [
      { name: "Women Sandals", qty: 1, price: 225 },
      { name: "Merry Christmas Grinch Shirt – size L, white", qty: 2, price: 250 },
    ],
    total: 725,
  };

  // everything a design can show, for one order (or business only for a letterhead)
  function buildData(order, biz, invoiceDate) {
    biz = biz || {};
    const o = order || null;
    const ref = o ? String(o.id).slice(0, 8).toUpperCase() : "";
    const paid = o ? isPaid(o.status) : false;
    const f = {
      business_name: biz.business_name || "Nook & Novelty", tagline: biz.tagline || "",
      business_address: biz.address || "", business_phone: biz.phone || "", business_whatsapp: biz.whatsapp || "",
      business_email: biz.email || "", business_website: biz.website || "", reg_no: biz.reg_no || "", vat_no: biz.vat_no || "",
      bank_name: biz.bank_name || "", account_name: biz.account_name || "", account_number: biz.account_number || "",
      branch_code: biz.branch_code || "", account_type: biz.account_type || "", payment_note: biz.payment_note || "",
      today: longDate(invoiceDate || new Date()), page: "1", pages: "1",
      invoice_no: "", invoice_date: "", order_date: "", order_ref: "", status: "",
      customer_name: "", customer_email: "", customer_phone: "", customer_address: "",
      total: "", amount_due: "", paid_amount: "", item_count: "", payment_reference: "",
    };
    if (o) Object.assign(f, {
      invoice_no: "INV-" + ref, invoice_date: longDate(invoiceDate || new Date()), order_date: longDate(o.created_at),
      order_ref: ref, status: STATUS[o.status] || o.status || "", payment_reference: ref,
      customer_name: o.customer_name || "", customer_email: o.email || "", customer_phone: o.phone || "",
      customer_address: o.address || "",
      total: money(o.total), amount_due: money(paid ? 0 : o.total), paid_amount: money(paid ? o.total : 0),
      item_count: String((o.items || []).reduce((t, i) => t + Number(i.qty || 0), 0)),
    });
    return { fields: f, items: o ? (o.items || []) : [], paid };
  }

  // "{customer_name}" -> "Wentzel"; drops lines that only held empty fields (if hideEmpty)
  function fill(text, fields, hideEmpty = true) {
    const out = [];
    for (const line of String(text ?? "").split("\n")) {
      const filled = line.replace(/\{(\w+)\}/g, (m, k) => (k in fields ? String(fields[k]) : m));
      if (hideEmpty && /\{\w+\}/.test(line) && !filled.trim()) continue;
      out.push(filled);
    }
    return out.join("\n");
  }
  const visible = (el, paid) => !el.show || el.show === "always" || (el.show === "paid" ? paid : !paid);

  // the standard PDF fonts only know Western characters — swap anything else
  const safe = (s) => String(s ?? "")
    .replace(/[   ]/g, " ").replace(/[‐-‒]/g, "-")
    .replace(/[^\n\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g, "?");

  // word-wrap to a width using a measure(str) function
  function wrapLines(text, measure, width) {
    const lines = [];
    for (const para of String(text).split("\n")) {
      if (!para) { lines.push(""); continue; }
      let cur = "";
      for (const word of para.split(/ +/)) {
        const t = cur ? cur + " " + word : word;
        if (measure(t) <= width || !cur) {
          cur = t;
          // a single word wider than the box: break it
          while (measure(cur) > width && cur.length > 1) {
            let cut = cur.length - 1;
            while (cut > 1 && measure(cur.slice(0, cut)) > width) cut--;
            lines.push(cur.slice(0, cut)); cur = cur.slice(cut);
          }
        } else { lines.push(cur); cur = word; }
      }
      lines.push(cur);
    }
    return lines;
  }

  // shared text layout: lines with x offset and top (relative to the element)
  function layoutText(el, text, measureAt) {
    const size = Number(el.size) || 10, lh = size * (Number(el.lineHeight) || 1.25);
    const lines = wrapLines(text, (s) => measureAt(s, size), Math.max(4, Number(el.w) || 100));
    return lines.map((ln, i) => {
      const tw = measureAt(ln, size);
      const dx = el.align === "center" ? (el.w - tw) / 2 : el.align === "right" ? el.w - tw : 0;
      return { text: ln, dx, top: i * lh + (lh - size) / 2, size };
    });
  }

  // shared items-table layout
  const TABLE_COLS = { qty: 50, unit: 85, amount: 85 };
  function tableHeaderHeight(el) { return (Number(el.size) || 10) * 2.3; }
  function tableRowLayout(el, item, measureAt) {
    const size = Number(el.size) || 10;
    const descW = el.w - TABLE_COLS.qty - TABLE_COLS.unit - TABLE_COLS.amount - 12;
    const lines = wrapLines(String(item.name || ""), (s) => measureAt(s, size), descW);
    return { lines, h: lines.length * size * 1.3 + size * 0.9 };
  }

  // ---------- default designs (the current invoice look) ----------
  const T = (o) => Object.assign({ id: uid(), type: "text", font: "helvetica", bold: false, italic: false,
    size: 10, color: "#1d1d1f", align: "left", lineHeight: 1.25, hideEmpty: true, show: "always", pin: false }, o);
  function defaultHeader() {
    return { height: 135, background: "#ffffff", elements: [
      { id: uid(), type: "logo", x: 48, y: 36, w: 78, h: 78 },
      T({ x: 140, y: 40, w: 300, h: 20, text: "{business_name}", bold: true, size: 15 }),
      T({ x: 140, y: 62, w: 300, h: 56, text: "{tagline}\n{business_address}\n{business_phone}\n{business_email}",
          size: 9, color: "#6b6b70", lineHeight: 1.3 }),
      { id: uid(), type: "line", x: 48, y: 128, length: 499, dir: "h", thickness: 1, color: "#e3e1dc", dash: false },
    ] };
  }
  function defaultInvoice() {
    const G = "#1f6f5c", MU = "#6b6b70";
    return { elements: [
      T({ x: 320, y: 36, w: 227, h: 30, text: "INVOICE", bold: true, size: 24, color: G, align: "right" }),
      T({ x: 300, y: 74, w: 130, h: 44, text: "Invoice no.\nInvoice date\nOrder date", size: 9, color: MU, align: "right", lineHeight: 1.6, hideEmpty: false }),
      T({ x: 435, y: 74, w: 112, h: 44, text: "{invoice_no}\n{invoice_date}\n{order_date}", size: 9.5, bold: true, align: "right", lineHeight: 1.5, hideEmpty: false }),
      T({ x: 48, y: 152, w: 200, h: 12, text: "BILL TO", bold: true, size: 8.5, color: G }),
      T({ x: 48, y: 167, w: 280, h: 16, text: "{customer_name}", bold: true, size: 11 }),
      T({ x: 48, y: 185, w: 280, h: 48, text: "{customer_email}\n{customer_phone}\n{customer_address}", size: 9.5, color: MU, lineHeight: 1.3 }),
      { id: uid(), type: "table", x: 48, y: 250, w: 499, h: 92, font: "helvetica", size: 10,
        headerBg: G, headerColor: "#ffffff", stripe: "#f4f7f6", lineColor: "#e3e1dc", color: "#1d1d1f", show: "always", pin: false },
      T({ x: 330, y: 352, w: 120, h: 14, text: "Total", bold: true, size: 11, align: "right" }),
      T({ x: 455, y: 352, w: 84, h: 14, text: "{total}", bold: true, size: 11, align: "right" }),
      { id: uid(), type: "box", x: 330, y: 372, w: 217, h: 24, radius: 5, fill: "#f4f7f6", borderColor: "#e3e1dc", borderWidth: 0, show: "always", pin: false },
      T({ x: 330, y: 377, w: 120, h: 14, text: "Amount due", bold: true, size: 11, color: G, align: "right" }),
      T({ x: 455, y: 376, w: 84, h: 15, text: "{amount_due}", bold: true, size: 12, color: G, align: "right" }),
      T({ x: 48, y: 420, w: 260, h: 12, text: "PAYMENT DETAILS (EFT)", bold: true, size: 8.5, color: G, show: "unpaid" }),
      T({ x: 48, y: 436, w: 110, h: 84, text: "Bank\nAccount holder\nAccount number\nBranch code\nAccount type\nReference",
          size: 9.5, color: MU, lineHeight: 1.45, hideEmpty: false, show: "unpaid" }),
      T({ x: 160, y: 436, w: 260, h: 84, text: "{bank_name}\n{account_name}\n{account_number}\n{branch_code}\n{account_type}\n{payment_reference}",
          size: 9.5, bold: true, lineHeight: 1.45, hideEmpty: false, show: "unpaid" }),
      T({ x: 48, y: 420, w: 300, h: 18, text: "PAID - thank you!", bold: true, size: 13, color: G, show: "paid" }),
      T({ x: 48, y: 534, w: 499, h: 30, text: "{payment_note}", size: 9.5, color: MU, lineHeight: 1.3, show: "unpaid" }),
      { id: uid(), type: "line", x: 48, y: 800, length: 499, dir: "h", thickness: 0.5, color: "#e3e1dc", dash: false, show: "always", pin: true },
      T({ x: 48, y: 808, w: 330, h: 12, text: "Thank you for shopping with {business_name}!", size: 9, color: MU, pin: true }),
      T({ x: 400, y: 808, w: 147, h: 12, text: "Page {page} of {pages}", size: 9, color: MU, align: "right", pin: true }),
    ] };
  }

  // box/element height used for flow calculations
  const elHeight = (el) => el.type === "line" ? (el.dir === "v" ? el.length : el.thickness || 1) : (Number(el.h) || 0);

  // ---------- PDF ----------
  async function renderPdf(PDFLib, opts) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const header = opts.header || defaultHeader();
    const invoice = opts.invoice || defaultInvoice();
    const data = opts.data;
    const mode = opts.mode || "invoice";
    const pdf = await PDFDocument.create();
    pdf.setTitle(opts.title || (mode === "letterhead" ? "Letterhead" : "Invoice " + (data.fields.invoice_no || "")));
    pdf.setAuthor(data.fields.business_name || "");

    const FMAP = {
      helvetica: ["Helvetica", "HelveticaBold", "HelveticaOblique", "HelveticaBoldOblique"],
      times: ["TimesRoman", "TimesRomanBold", "TimesRomanItalic", "TimesRomanBoldItalic"],
      courier: ["Courier", "CourierBold", "CourierOblique", "CourierBoldOblique"],
    };
    const fontCache = {};
    async function fontFor(el, forceBold) {
      const fam = FMAP[el.font] || FMAP.helvetica;
      const name = fam[(el.bold || forceBold ? 1 : 0) + (el.italic ? 2 : 0)];
      if (!fontCache[name]) fontCache[name] = await pdf.embedFont(StandardFonts[name]);
      return fontCache[name];
    }
    const col = (hex) => {
      let h = String(hex || "#000000").replace("#", "");
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const n = parseInt(h, 16) || 0;
      return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    };
    // images: an uploaded picture (el.src) or, if none, the business logo; each loaded once
    const imgCache = {};
    async function getImage(src) {
      const key = src || "__logo";
      if (key in imgCache) return imgCache[key];
      imgCache[key] = null;
      try {
        const b = opts.loadImage ? await opts.loadImage(src || null) : null;
        if (b && b.length) imgCache[key] = b[0] === 0x89 ? await pdf.embedPng(b) : await pdf.embedJpg(b);
      } catch (_) { /* image couldn't be loaded */ }
      return imgCache[key];
    }

    const pages = [];
    const bg = header.background && header.background.toLowerCase() !== "#ffffff" ? header.background : null;

    async function drawEl(page, el, dy, fields) {
      const y = Number(el.y) + dy;
      if (el.type === "text") {
        const f = await fontFor(el);
        const text = safe(fill(el.text, fields, el.hideEmpty !== false));
        const lines = layoutText(el, text, (s, sz) => f.widthOfTextAtSize(s, sz));
        for (const ln of lines) {
          if (!ln.text) continue;
          page.drawText(ln.text, { x: el.x + ln.dx, y: H - (y + ln.top + ln.size * 0.85), size: ln.size, font: f, color: col(el.color) });
        }
      } else if (el.type === "line") {
        const t = Number(el.thickness) || 1;
        const end = el.dir === "v" ? { x: el.x, y: H - (y + el.length) } : { x: el.x + el.length, y: H - y };
        page.drawLine({ start: { x: el.x, y: H - y }, end, thickness: t, color: col(el.color),
          ...(el.dash ? { dashArray: [t * 4, t * 3] } : {}) });
      } else if (el.type === "box") {
        const w = Number(el.w), h = Number(el.h), r = Math.max(0, Math.min(Number(el.radius) || 0, w / 2, h / 2));
        const bw = Number(el.borderWidth) || 0;
        const hasFill = el.fill && el.fill !== "none";
        if (!hasFill && !bw) return;
        const p = r
          ? `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
          : `M 0 0 H ${w} V ${h} H 0 Z`;
        page.drawSvgPath(p, { x: el.x, y: H - y,
          ...(hasFill ? { color: col(el.fill) } : {}),
          ...(bw ? { borderColor: col(el.borderColor), borderWidth: bw } : {}) });
      } else if (el.type === "logo") {
        const img = await getImage(el.src);
        if (!img) return;
        const s = Math.min(el.w / img.width, el.h / img.height);
        const dw = img.width * s, dh = img.height * s;
        page.drawImage(img, { x: el.x + (el.w - dw) / 2, y: H - (y + (el.h - dh) / 2 + dh), width: dw, height: dh });
      }
    }

    async function drawTableHeader(page, el, top) {
      const f = await fontFor(el, true), size = Number(el.size) || 10, hh = tableHeaderHeight(el);
      page.drawRectangle({ x: el.x, y: H - (top + hh), width: el.w, height: hh, color: col(el.headerBg) });
      const base = H - (top + (hh - size) / 2 + size * 0.85), c = col(el.headerColor);
      const R = (s, xr) => page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size * 0.95), y: base, size: size * 0.95, font: f, color: c });
      page.drawText("Description", { x: el.x + 6, y: base, size: size * 0.95, font: f, color: c });
      const xQ = el.x + el.w - TABLE_COLS.amount - TABLE_COLS.unit, xU = el.x + el.w - TABLE_COLS.amount;
      R("Qty", xQ - 6); R("Unit price", xU - 6); R("Amount", el.x + el.w - 6);
      return top + hh;
    }
    async function drawTableRow(page, el, item, i, top, row) {
      const f = await fontFor(el), size = Number(el.size) || 10, c = col(el.color);
      if (i % 2 && el.stripe && el.stripe !== "none") page.drawRectangle({ x: el.x, y: H - (top + row.h), width: el.w, height: row.h, color: col(el.stripe) });
      const pad = size * 0.45;
      row.lines.forEach((ln, k) => page.drawText(safe(ln), { x: el.x + 6, y: H - (top + pad + k * size * 1.3 + size * 0.85), size, font: f, color: c }));
      const base = H - (top + pad + size * 0.85);
      const R = (s, xr) => page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y: base, size, font: f, color: c });
      const xQ = el.x + el.w - TABLE_COLS.amount - TABLE_COLS.unit, xU = el.x + el.w - TABLE_COLS.amount;
      R(String(item.qty), xQ - 6); R(money(item.price), xU - 6); R(money(item.price * item.qty), el.x + el.w - 6);
      page.drawLine({ start: { x: el.x, y: H - (top + row.h) }, end: { x: el.x + el.w, y: H - (top + row.h) }, thickness: 0.5, color: col(el.lineColor) });
      return top + row.h;
    }

    // ---------- reports (dashboard): business header + title + optional bar chart + table ----------
    // opts.report = { title, subtitle, chart: { bars: [{ label, sub, value, text }] }, summary,
    //                 columns: [{ label, w (share of width), align }], rows: [[cell, …]], totals: [cell, …] }
    async function drawReport() {
      const r = opts.report || {};
      const tEl = (invoice.elements || []).find((e) => e.type === "table") || {};
      const accent = tEl.headerBg || "#1f6f5c", headText = tEl.headerColor || "#ffffff";
      const stripe = tEl.stripe && tEl.stripe !== "none" ? tEl.stripe : null, lineCol = tEl.lineColor || "#e3e1dc";
      const ink = col("#1d1d1f"), muted = col("#6b6b70");
      const reg = await fontFor({ font: "helvetica" }), bold = await fontFor({ font: "helvetica" }, true);
      const X = 48, RW = W - 96, top0 = (Number(header.height) || 135) + 18, limit = H - 60;
      const text = (p, s, x, y, size, f, c) => p.drawText(safe(s), { x, y: H - y - size * 0.85, size, font: f, color: c });

      let y = top0;
      text(page, r.title || "Report", X, y, 16, bold, ink); y += 22;
      if (r.subtitle) { text(page, r.subtitle, X, y, 9.5, reg, muted); y += 16; }
      y += 6;

      // bar chart
      if (r.chart && r.chart.bars && r.chart.bars.length) {
        const bars = r.chart.bars, ch = 190, gap = 12;
        const bw = (RW - gap * (bars.length - 1)) / bars.length, max = Math.max(1, ...bars.map((b) => b.value || 0));
        const base = y + 16 + ch;
        bars.forEach((b, i) => {
          const bx = X + i * (bw + gap), bh = (b.value || 0) / max * ch;
          const w = Math.min(bw, 56), cx = bx + (bw - w) / 2;
          if (bh > 0) page.drawRectangle({ x: cx, y: H - base, width: w, height: Math.max(bh, 1.5), color: col(b.highlight ? "#14493c" : accent) });
          const lbl = safe(b.text || "");
          if (lbl) page.drawText(lbl, { x: bx + (bw - reg.widthOfTextAtSize(lbl, 8)) / 2, y: H - base + bh + 4, size: 8, font: reg, color: ink });
          const l1 = safe(b.label || ""), l2 = safe(b.sub || "");
          page.drawText(l1, { x: bx + (bw - bold.widthOfTextAtSize(l1, 8.5)) / 2, y: H - base - 13, size: 8.5, font: bold, color: ink });
          l2.split("\n").forEach((s, k) => page.drawText(s, { x: bx + (bw - reg.widthOfTextAtSize(s, 8)) / 2, y: H - base - 24 - k * 10, size: 8, font: reg, color: muted }));
        });
        page.drawLine({ start: { x: X, y: H - base }, end: { x: X + RW, y: H - base }, thickness: 0.7, color: col(lineCol) });
        y = base + 46;
      }
      if (r.summary) { text(page, r.summary, X, y, 10, bold, ink); y += 22; }

      // table
      const cols = r.columns || [];
      if (cols.length) {
        const share = cols.reduce((t, c) => t + (c.w || 1), 0);
        const widths = cols.map((c) => RW * (c.w || 1) / share);
        const xs = widths.map((_, i) => X + widths.slice(0, i).reduce((t, w) => t + w, 0));
        const size = 9, lh = size * 1.3, pad = 5, hh = 22;
        const cellLines = (s, i, f) => wrapLines(safe(s), (t) => f.widthOfTextAtSize(t, size), widths[i] - pad * 2);
        const drawRow = (cells, f, top, h, color) => cells.forEach((cell, i) => {
          cellLines(cell, i, f).forEach((ln, k) => {
            const tw = f.widthOfTextAtSize(ln, size);
            const x = cols[i].align === "right" ? xs[i] + widths[i] - pad - tw : xs[i] + pad;
            page.drawText(ln, { x, y: H - (top + pad + k * lh + size * 0.85), size, font: f, color });
          });
        });
        const head = () => {
          page.drawRectangle({ x: X, y: H - (y + hh), width: RW, height: hh, color: col(accent) });
          cols.forEach((c, i) => {
            const s = safe(c.label), tw = bold.widthOfTextAtSize(s, size);
            const x = c.align === "right" ? xs[i] + widths[i] - pad - tw : xs[i] + pad;
            page.drawText(s, { x, y: H - (y + (hh - size) / 2 + size * 0.85), size, font: bold, color: col(headText) });
          });
          y += hh;
        };
        if (y + hh + 30 > limit) { page = await newPage(); y = top0; }
        head();
        const rows = r.rows || [];
        if (!rows.length) { text(page, r.empty || "Nothing for this day.", X + pad, y + 8, 9.5, reg, muted); y += 28; }
        for (let n = 0; n < rows.length; n++) {
          const h = Math.max(...rows[n].map((c, i) => cellLines(c, i, reg).length)) * lh + pad * 2 - 2;
          if (y + h > limit) { page = await newPage(); y = top0; head(); }
          if (stripe && n % 2) page.drawRectangle({ x: X, y: H - (y + h), width: RW, height: h, color: col(stripe) });
          drawRow(rows[n], reg, y, h, ink);
          page.drawLine({ start: { x: X, y: H - (y + h) }, end: { x: X + RW, y: H - (y + h) }, thickness: 0.5, color: col(lineCol) });
          y += h;
        }
        if (r.totals && rows.length) {
          const h = Math.max(...r.totals.map((c, i) => cellLines(c, i, bold).length)) * lh + pad * 2;
          if (y + h > limit) { page = await newPage(); y = top0; head(); }
          drawRow(r.totals, bold, y, h, ink);
          page.drawLine({ start: { x: X, y: H - (y + h) }, end: { x: X + RW, y: H - (y + h) }, thickness: 1, color: col(accent) });
          y += h;
        }
      }
      // footer on every page
      const printed = "Printed " + longDate(new Date());
      pages.forEach((p, i) => {
        const pg = `Page ${i + 1} of ${pages.length}`;
        p.drawLine({ start: { x: X, y: 44 }, end: { x: X + RW, y: 44 }, thickness: 0.5, color: col(lineCol) });
        p.drawText(safe((r.title || "") + " · " + printed), { x: X, y: 30, size: 8, font: reg, color: muted });
        p.drawText(pg, { x: X + RW - reg.widthOfTextAtSize(pg, 8), y: 30, size: 8, font: reg, color: muted });
      });
    }

    async function newPage() {
      const p = pdf.addPage([W, H]);
      pages.push(p);
      if (bg) p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: col(bg) });
      for (const el of header.elements || []) await drawEl(p, el, 0, data.fields);
      return p;
    }

    let page = await newPage();
    if (mode === "report") {
      await drawReport();
    } else if (mode !== "letterhead") {
      const body = (invoice.elements || []).filter((e) => visible(e, data.paid));
      const pinned = body.filter((e) => e.pin);
      const flowEls = body.filter((e) => !e.pin);
      const table = flowEls.find((e) => e.type === "table");
      const contentTop = (Number(header.height) || 135) + 15;

      if (!table) {
        for (const el of flowEls) await drawEl(page, el, 0, data.fields);
      } else {
        const above = flowEls.filter((e) => e !== table && e.y < table.y);
        const below = flowEls.filter((e) => e !== table && e.y >= table.y);
        // the footer area starts at the highest footer item in the bottom part of the page
        const footerEls = pinned.filter((e) => e.y > table.y && e.y >= H - 220);
        const limit = footerEls.length ? Math.min(...footerEls.map((e) => e.y)) - 10 : H - 50;
        const measure = (s, sz) => fontCache.__m ? fontCache.__m.widthOfTextAtSize(s, sz) : 0;
        fontCache.__m = await fontFor(table);

        for (const el of above) await drawEl(page, el, 0, data.fields);
        let y = await drawTableHeader(page, table, table.y);
        for (let i = 0; i < data.items.length; i++) {
          const row = tableRowLayout(table, data.items[i], measure);
          if (y + row.h > limit) { page = await newPage(); y = await drawTableHeader(page, table, contentTop); }
          y = await drawTableRow(page, table, data.items[i], i, y, row);
        }
        // items below the table stay where they were designed, and only move down if the table needs more room
        let dy = Math.max(0, y + 8 - (table.y + Number(table.h)));
        if (below.length) {
          // only start a new page when the table pushed things down past the footer;
          // items you placed low on the page yourself never force a new page
          const fits = below.filter((e) => e.y + elHeight(e) <= limit);
          const maxY = fits.length ? Math.max(...fits.map((e) => e.y + elHeight(e))) : 0;
          if (dy > 0 && fits.length && maxY + dy > limit) {
            const minY = Math.min(...below.map((e) => e.y));
            page = await newPage(); dy = contentTop - minY;
          }
          for (const el of below) await drawEl(page, el, dy, data.fields);
        }
      }
      // footer-type elements on every page, with page numbers
      for (let i = 0; i < pages.length; i++) {
        const fields = { ...data.fields, page: String(i + 1), pages: String(pages.length) };
        for (const el of pinned) await drawEl(pages[i], el, 0, fields);
      }
    }
    return await pdf.save();
  }

  return {
    W, H, FIELDS, SAMPLE_ORDER, TABLE_COLS, uid, money, longDate, isPaid, buildData, fill, visible, safe,
    wrapLines, layoutText, tableHeaderHeight, tableRowLayout, defaultHeader, defaultInvoice, elHeight, renderPdf,
  };
}
if (typeof window !== "undefined") window.DesignRender = createDesignRender();
