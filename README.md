# Photo Print Funnel — Setup Guide

Four funnels, built from the "Free Book" / "Upsell-Downsell" style templates
we mapped out earlier, adapted to sell a single canvas print or a 3-print
series:

```
single-photo/   sales page -> upsell -> downsell -> thank-you
series/         sales page -> upsell -> downsell -> thank-you
horse/          sales page -> upsell -> downsell -> thank-you
wave/           sales page -> upsell -> downsell -> thank-you
assets/         shared CSS + your images go here
functions/      Stripe checkout + the Stripe -> Printful "glue" code
```

`horse/` and `wave/` are two **standalone, single-photo funnels** — each
sells one photo on its own (using the same page flow as `single-photo/`,
but with a size-upgrade upsell/downsell instead of a series bundle). They
are intentionally kept separate: neither page links to or mentions the
other, so a visitor buying the horse print never sees the wave print, and
vice versa. If you add more standalone photos later, follow this same
pattern — a new top-level folder per photo, no cross-links.

Checkout happens **inline, on the page itself** — no redirect to a
stripe.com payment page. Each "Buy" button calls a Netlify function that
creates a Stripe Checkout Session, then Stripe's Embedded Checkout form
mounts directly into the page. Every page has an EDIT-ME comment block at
the top listing exactly what to change. Nothing here is wired to real
payment or fulfillment yet — that's what the steps below do.

## 1. Add your photos

Drop your image files into `assets/img/`. Suggested naming (matches the
placeholders already in the HTML):

- `single-hero.jpg` — the photo featured on the single-photo sales page
- `series-1.jpg`, `series-2.jpg`, `series-3.jpg` — the three series photos
- `horse-hero.jpg` — the photo featured on the horse sales page
- `wave-hero.jpg` — the photo featured on the wave sales page

Then in each HTML file, replace the placeholder `<div class="hero-image
placeholder">...</div>` with an `<img>` tag, e.g.:

```html
<img src="../assets/img/single-hero.jpg" alt="Photo Title">
```

Keep a second, full-resolution copy of each image hosted somewhere public
(S3, Cloudflare R2, even a private GitHub repo's raw URL) — that's the file
Printful actually prints from, and it needs to be reachable by URL, not just
sitting in your GitHub Pages repo. Put those URLs into `functions/product-config.js`
(see step 4).

## 2. Set your prices and copy

Search each HTML file for bracketed placeholders like `[PRICE]`,
`[Photo Title]`, `[Your Name]` and fill them in. Keep the series bundle
price below 3x the single price — that discount is what makes the bundle
the obviously better deal.

## 3. Create Stripe products and wire up your API keys

There's no Stripe Dashboard configuration to keep in sync anymore — every
offer's price and behavior lives in one file, `functions/product-config.js`.
That's the single source of truth for both the checkout function and the
fulfillment function.

1. In the Stripe Dashboard, go to Products > Add product and create one
   product + price for each of the 12 offers below. You only need the
   **Price ID** (starts with `price_`) — you do NOT need to create Payment
   Links.

   | Funnel | Page | What it sells | `product-config.js` key |
   |---|---|---|---|
   | single-photo | index.html | the single canvas print | `single-index` |
   | single-photo | upsell.html | the other 2 prints, bundled | `single-upsell` |
   | single-photo | downsell.html | 1 additional print | `single-downsell` |
   | series | index.html | the 3-print bundle | `series-index` |
   | series | upsell.html | size upgrade, all 3 | `series-upsell` |
   | series | downsell.html | size upgrade, 1 print | `series-downsell` |
   | horse | index.html | the horse canvas print | `horse-index` |
   | horse | upsell.html | size upgrade (16x20 -> 24x36) | `horse-upsell` |
   | horse | downsell.html | premium framing add-on | `horse-downsell` |
   | wave | index.html | the wave canvas print | `wave-index` |
   | wave | upsell.html | size upgrade (16x20 -> 24x36) | `wave-upsell` |
   | wave | downsell.html | premium framing add-on | `wave-downsell` |

2. Open `functions/product-config.js` and, for each key above, paste in the
   matching `price_id`. The `return_path` for each entry already points to
   the right next page in that funnel (sales page success -> upsell.html,
   upsell decline -> downsell.html, either checkout success ->
   thank-you.html) — Stripe redirects there automatically after payment, no
   dashboard "after payment" setting needed.

3. Grab two API keys from Stripe Dashboard > Developers > API keys:
   - **Publishable key** (starts with `pk_`) — safe to expose in client-side
     code. Paste it into the `STRIPE_PUBLISHABLE_KEY` placeholder near the
     bottom of every HTML file (search for it, or edit each per the EDIT-ME
     checklist at the top of the file).
   - **Secret key** (starts with `sk_`) — never commit this or put it in any
     HTML file. It's a server-only environment variable, set in step 5.

## 4. Connect Printful

In your Printful dashboard, add each canvas size/product you're selling and
note its **variant ID** (shown per size option). Put those into
`functions/product-config.js` next to the matching `price_id` — single-item
offers use `variant_id` + `image_url` directly; the `series-*` offers use a
`bundle` array of three `{ variant_id, image_url }` entries instead (one
Stripe charge, three Printful line items). Also grab your Printful API key
from Settings > Stores > API — you'll set it as an environment variable,
never hard-code it.

## 5. Deploy

GitHub Pages can serve the HTML/CSS, but it can't run server code. Easiest
path: deploy this whole repo to **Netlify** instead — it hosts the static
pages *and* runs both functions, from this same GitHub repo, in one
connected deploy:

1. Push this folder to a GitHub repo.
2. In Netlify: "Add new site" > "Import from GitHub" > pick the repo.
3. Move `functions/create-checkout-session.js`, `functions/fulfill-order.js`,
   and `functions/product-config.js` into `netlify/functions/` (Netlify's
   expected location) before or after connecting — either works. All three
   files need to travel together since the two handler functions both
   import `product-config.js`.
4. In Netlify > Site settings > Environment variables, add:
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PRINTFUL_API_KEY`.
5. Deploy. Your functions will be live at
   `https://yoursite.netlify.app/.netlify/functions/create-checkout-session`
   and `https://yoursite.netlify.app/.netlify/functions/fulfill-order`.
6. In Stripe > Developers > Webhooks, add an endpoint pointing at the
   `fulfill-order` URL, listening for `checkout.session.completed`. Stripe
   will give you the webhook signing secret — that's your
   `STRIPE_WEBHOOK_SECRET`.

(Prefer to keep GitHub Pages for hosting specifically? You still can — just
run both functions on Vercel or Cloudflare Workers instead, and point the
`fetch('/.netlify/functions/create-checkout-session')` calls in the HTML
plus Stripe's webhook at whichever URLs that gives you. The HTML/CSS
doesn't change either way.)

## 6. Test before going live

Stripe has test mode with fake card numbers (4242 4242 4242 4242) — use it
to click "Buy," confirm the embedded checkout form mounts inline on the
page, and run a full order through the funnel to confirm a draft order
shows up in your Printful dashboard. The function submits orders with
`confirm: false` on purpose, so nothing actually prints while you're
testing; flip it to `true` in `fulfill-order.js` once you trust the
pipeline end to end.

## 7. Point your social post at it

Whichever photo (or the series) you feature in the post should be the exact
same hero image on the landing page it links to — that match is what makes
someone clicking from social actually convert once they land.
