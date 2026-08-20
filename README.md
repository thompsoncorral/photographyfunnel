# Photo Print Funnel — Setup Guide

Two funnels, built from the "Free Book" / "Upsell-Downsell" style templates
we mapped out earlier, adapted to sell a single canvas print or a 3-print
series:

```
single-photo/   sales page -> upsell -> downsell -> thank-you
series/         sales page -> upsell -> downsell -> thank-you
assets/         shared CSS + your images go here
functions/      the Stripe -> Printful "glue" code
```

Every page has an EDIT-ME comment block at the top listing exactly what to
change. Nothing here is wired to real payment or fulfillment yet — that's
what the steps below do.

## 1. Add your photos

Drop your image files into `assets/img/`. Suggested naming (matches the
placeholders already in the HTML):

- `single-hero.jpg` — the photo featured on the single-photo sales page
- `series-1.jpg`, `series-2.jpg`, `series-3.jpg` — the three series photos

Then in each HTML file, replace the placeholder `<div class="hero-image
placeholder">...</div>` with an `<img>` tag, e.g.:

```html
<img src="../assets/img/single-hero.jpg" alt="Photo Title">
```

Keep a second, full-resolution copy of each image hosted somewhere public
(S3, Cloudflare R2, even a private GitHub repo's raw URL) — that's the file
Printful actually prints from, and it needs to be reachable by URL, not just
sitting in your GitHub Pages repo. Put those URLs into `PRODUCT_MAP` in
`functions/fulfill-order.js`.

## 2. Set your prices and copy

Search each HTML file for bracketed placeholders like `[PRICE]`,
`[Photo Title]`, `[Your Name]` and fill them in. Keep the series bundle
price below 3x the single price — that discount is what makes the bundle
the obviously better deal.

## 3. Create Stripe products & Payment Links

You'll need one Stripe Product + Payment Link per offer — 8 total:

| Funnel | Page | What it sells |
|---|---|---|
| single-photo | index.html | the single canvas print |
| single-photo | upsell.html | the other 2 prints, bundled |
| single-photo | downsell.html | 1 additional print |
| series | index.html | the 3-print bundle |
| series | upsell.html | size upgrade, all 3 |
| series | downsell.html | size upgrade, 1 print |

For each one, in the Stripe Dashboard:
1. Products > Add product > set the price.
2. Payment links > Create payment link > select that product.
3. Under "After payment," set it to redirect to the *next* page in that
   funnel (sales page success -> upsell.html, upsell decline -> downsell.html,
   either checkout success -> thank-you.html). Turn on "Collect shipping
   address" — the fulfillment function needs it.
4. Copy the Payment Link URL into the matching `STRIPE_PAYMENT_LINK_*`
   placeholder in the HTML.
5. Copy the Stripe **Price ID** (starts with `price_`) into `PRODUCT_MAP`
   in `functions/fulfill-order.js`.

## 4. Connect Printful

In your Printful dashboard, add each canvas size/product you're selling and
note its **variant ID** (shown per size option). Put those into
`PRODUCT_MAP` in `functions/fulfill-order.js` next to the matching
Stripe Price ID. Also grab your Printful API key from Settings > Stores >
API — you'll set it as an environment variable, never hard-code it.

## 5. Deploy

GitHub Pages can serve the HTML/CSS, but it can't run `fulfill-order.js`
(it's static-hosting only, no server code). Easiest path: deploy this whole
repo to **Netlify** instead — it hosts the static pages *and* runs the
function, both from this same GitHub repo, in one connected deploy:

1. Push this folder to a GitHub repo.
2. In Netlify: "Add new site" > "Import from GitHub" > pick the repo.
3. Move `functions/fulfill-order.js` into `netlify/functions/` (Netlify's
   expected location) before or after connecting — either works.
4. In Netlify > Site settings > Environment variables, add:
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PRINTFUL_API_KEY`.
5. Deploy. Your function will be live at
   `https://yoursite.netlify.app/.netlify/functions/fulfill-order`.
6. In Stripe > Developers > Webhooks, add an endpoint pointing at that URL,
   listening for `checkout.session.completed`. Stripe will give you the
   webhook signing secret — that's your `STRIPE_WEBHOOK_SECRET`.

(Prefer to keep GitHub Pages for hosting specifically? You still can — just
run the function on Vercel or Cloudflare Workers instead, and point Stripe's
webhook at whichever URL that gives you. The HTML/CSS doesn't change either
way.)

## 6. Test before going live

Stripe has test mode with fake card numbers (4242 4242 4242 4242) — use it
to run a full order through the funnel and confirm a draft order shows up
in your Printful dashboard. The function submits orders with `confirm:
false` on purpose, so nothing actually prints while you're testing; flip it
to `true` in `fulfill-order.js` once you trust the pipeline end to end.

## 7. Point your social post at it

Whichever photo (or the series) you feature in the post should be the exact
same hero image on the landing page it links to — that match is what makes
someone clicking from social actually convert once they land.
