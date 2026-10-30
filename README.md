# Online Shop — Supabase + GitHub + Vercel

A plain HTML/JS online shop. No build step, no framework.

- `index.html` — public storefront: browse, search, filter by category, cart, checkout
- `admin.html` — team-only: log in, add/edit/delete products with image upload, manage orders
- `supabase/schema.sql` — database tables, security rules, image storage, and the order function
- `config.js` — your Supabase URL and key, shop name, currency

## How it is secured

- Shoppers can only **read visible products**. They cannot read orders or change anything.
- Orders go through the `place_order` database function, which takes prices from the database
  (so nobody can change a price in their browser) and reduces stock automatically.
- Only logged-in team members can manage products, images and orders.
- There is **no public sign-up**. You create team accounts yourself in Supabase.

---

## 1. Set up Supabase (about 5 minutes)

1. Go to https://supabase.com, sign in, and click **New project**. Pick a region close to your
   customers and set a database password.
2. When it's ready, open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`,
   and click **Run**. You should see "Success".
3. **Turn off public sign-ups:** Authentication → Sign In / Providers → Email →
   switch off **Allow new users to sign up**. (Important — otherwise anyone could create an admin account.)
4. **Create your team logins:** Authentication → Users → **Add user → Create new user**.
   Enter an email and password and tick **Auto Confirm User**. Repeat for each team member.
5. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

## 2. Configure the app

Open `config.js` and paste in your Project URL and anon key. Change `SHOP_NAME` too.

To test locally, open the folder in VS Code and use the **Live Server** extension, or run
`npx serve .` in the folder, then open `http://localhost:3000` and `/admin.html`.

## 3. Put it on GitHub

1. Create a new repository on https://github.com/new (private is fine).
2. In this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial shop"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

## 4. Deploy on Vercel

1. Go to https://vercel.com, sign in with GitHub, and click **Add New → Project**.
2. Import your repository. Framework preset: **Other**. Leave build settings empty.
3. Click **Deploy**. You get a live URL like `your-shop.vercel.app`.
4. From now on, every `git push` to `main` redeploys automatically.

Then in Supabase → Authentication → URL Configuration, set **Site URL** to your Vercel URL.

## 5. Use it

- Storefront: `https://your-shop.vercel.app`
- Admin: `https://your-shop.vercel.app/admin.html` — log in with a team account, add products.

---

## What's not included yet (good next steps)

- **Online payments.** Orders are currently "pay later" (EFT / cash on delivery). For card payments
  in South Africa, PayFast, Yoco or Peach Payments can be added; this needs a Supabase Edge Function
  to verify payment notifications securely.
- **Order emails** to the customer and the team (e.g. with Resend via an Edge Function).
- **Multiple images per product**, product variants (sizes/colours), and discount codes.
