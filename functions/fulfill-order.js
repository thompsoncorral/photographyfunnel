/**
 * fulfill-order.js
 * ---------------------------------------------------------------
 * Stripe webhook -> Printful order bridge.
 *
 * This is the "glue" function GitHub Pages can't run on its own.
 * Flow:
 *   1. Stripe fires a webhook the moment a checkout succeeds.
 *   2. This function verifies the webhook is really from Stripe.
 *   3. It looks up which product was bought (via the Stripe Price ID)
 *      in PRODUCT_MAP below, to know which Printful variant + image to print.
 *   4. It pulls the buyer's shipping address from the Stripe session.
 *   5. It submits an order to the Printful API so the print gets made
 *      and shipped — no manual step on your end.
 *
 * WHERE TO RUN THIS
 * GitHub Pages only serves static files, it can't run this code. Deploy
 * this function on Netlify (recommended — it can host your static pages
 * from this same GitHub repo AND run this function in one deploy) or
 * Vercel/Cloudflare Workers with minor syntax tweaks. See README.md.
 *
 * ENV VARS YOU MUST SET (in Netlify/Vercel dashboard, never commit these)
 *   STRIPE_SECRET_KEY      - from Stripe Dashboard > Developers > API keys
 *   STRIPE_WEBHOOK_SECRET  - from Stripe Dashboard > Developers > Webhooks
 *                            (create an endpoint pointing at this function's URL,
 *                            listening for "checkout.session.completed")
 *   PRINTFUL_API_KEY       - from Printful Dashboard > Settings > Stores > API
 *
 * SETUP STEPS
 *   npm install stripe node-fetch
 * ---------------------------------------------------------------
 */

const Stripe = require('stripe');
const fetch = require('node-fetch');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * EDIT ME: map each Stripe Price ID to the Printful variant it should
 * print, and the publicly-accessible URL of the image file to print.
 * Get variant IDs from the Printful dashboard when you add each product
 * (Canvas > pick size) — Printful shows the variant_id for each option.
 *
 * Find your Stripe Price IDs in Stripe Dashboard > Product catalog,
 * after you create the Payment Links referenced in the HTML pages.
 */
const PRODUCT_MAP = {
  // Single-photo funnel
  'price_REPLACE_SINGLE_PHOTO': {
    variant_id: 0000, // Printful variant ID for e.g. 16x20 canvas
    image_url: 'https://yourdomain.com/assets/img/print-ready/photo-1-fullres.jpg',
    label: 'Single photo — 16x20 canvas',
  },
  'price_REPLACE_SINGLE_UPSELL': {
    variant_id: 0000, // variant for "the other 2 photos" bundle — may need 2 line items, see note below
    image_url: 'https://yourdomain.com/assets/img/print-ready/photo-2-fullres.jpg',
    label: 'Upsell — remaining 2 prints',
  },
  'price_REPLACE_SINGLE_DOWNSELL': {
    variant_id: 0000,
    image_url: 'https://yourdomain.com/assets/img/print-ready/photo-2-fullres.jpg',
    label: 'Downsell — 1 additional print',
  },

  // Series funnel
  'price_REPLACE_SERIES_BUNDLE': {
    // A bundle of 3 canvases = 3 separate line items in the Printful order.
    // List them here as an array; the code below detects the array and
    // submits one Printful line item per entry.
    bundle: [
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-1-fullres.jpg' },
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-2-fullres.jpg' },
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-3-fullres.jpg' },
    ],
    label: 'Full 3-print series',
  },
  'price_REPLACE_SERIES_UPSELL': {
    bundle: [
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-1-fullres.jpg' }, // 24x36 variant
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-2-fullres.jpg' },
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-3-fullres.jpg' },
    ],
    label: 'Series size upgrade (all 3, 24x36)',
  },
  'price_REPLACE_SERIES_DOWNSELL': {
    variant_id: 0000, // single 24x36 variant for lead photo only
    image_url: 'https://yourdomain.com/assets/img/print-ready/photo-1-fullres.jpg',
    label: 'Series downsell — 1 print upgraded',
  },

  // Horse funnel (standalone — never bundled with wave or any other photo)
  'price_REPLACE_HORSE': {
    variant_id: 0000, // Printful variant ID for e.g. 16x20 canvas
    image_url: 'https://yourdomain.com/assets/img/print-ready/horse-fullres.jpg',
    label: 'Horse print — 16x20 canvas',
  },
  'price_REPLACE_HORSE_UPSELL': {
    variant_id: 0000, // 24x36 variant
    image_url: 'https://yourdomain.com/assets/img/print-ready/horse-fullres.jpg',
    label: 'Horse upsell — size upgrade to 24x36',
  },
  'price_REPLACE_HORSE_DOWNSELL': {
    variant_id: 0000, // framed 16x20 variant
    image_url: 'https://yourdomain.com/assets/img/print-ready/horse-fullres.jpg',
    label: 'Horse downsell — premium framing add-on',
  },

  // Wave funnel (standalone — never bundled with horse or any other photo)
  'price_REPLACE_WAVE': {
    variant_id: 0000, // Printful variant ID for e.g. 16x20 canvas
    image_url: 'https://yourdomain.com/assets/img/print-ready/wave-fullres.jpg',
    label: 'Wave print — 16x20 canvas',
  },
  'price_REPLACE_WAVE_UPSELL': {
    variant_id: 0000, // 24x36 variant
    image_url: 'https://yourdomain.com/assets/img/print-ready/wave-fullres.jpg',
    label: 'Wave upsell — size upgrade to 24x36',
  },
  'price_REPLACE_WAVE_DOWNSELL': {
    variant_id: 0000, // framed 16x20 variant
    image_url: 'https://yourdomain.com/assets/img/print-ready/wave-fullres.jpg',
    label: 'Wave downsell — premium framing add-on',
  },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ---- 1. Verify this request really came from Stripe ----
  let stripeEvent;
  try {
    const signature = event.headers['stripe-signature'];
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    // Not the event we care about — acknowledge and exit.
    return { statusCode: 200, body: 'Ignored non-checkout event' };
  }

  const session = stripeEvent.data.object;

  // ---- 2. Pull full session details (line items + shipping address) ----
  const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items', 'line_items.data.price'],
  });

  const shipping = fullSession.shipping_details || fullSession.customer_details;
  if (!shipping || !shipping.address) {
    console.error('No shipping address on session', session.id);
    return { statusCode: 400, body: 'Missing shipping address' };
  }

  const recipient = {
    name: shipping.name,
    address1: shipping.address.line1,
    address2: shipping.address.line2 || '',
    city: shipping.address.city,
    state_code: shipping.address.state,
    country_code: shipping.address.country,
    zip: shipping.address.postal_code,
    email: fullSession.customer_details?.email,
  };

  // ---- 3. Build the Printful order from whichever product(s) were bought ----
  const printfulItems = [];

  for (const lineItem of fullSession.line_items.data) {
    const priceId = lineItem.price.id;
    const mapped = PRODUCT_MAP[priceId];

    if (!mapped) {
      console.error(`No PRODUCT_MAP entry for Stripe price ${priceId} — order needs manual handling.`);
      continue;
    }

    if (mapped.bundle) {
      // Bundle products (the series) become multiple Printful line items.
      for (const item of mapped.bundle) {
        printfulItems.push({
          variant_id: item.variant_id,
          quantity: lineItem.quantity || 1,
          files: [{ url: item.image_url }],
        });
      }
    } else {
      printfulItems.push({
        variant_id: mapped.variant_id,
        quantity: lineItem.quantity || 1,
        files: [{ url: mapped.image_url }],
      });
    }
  }

  if (printfulItems.length === 0) {
    console.error('No matching Printful items for session', session.id);
    return { statusCode: 200, body: 'No items to fulfill' };
  }

  // ---- 4. Submit the order to Printful ----
  // confirm: false creates a DRAFT order you approve in the Printful
  // dashboard before it prints — good while you're testing. Switch to
  // true once you trust the pipeline, so orders print automatically.
  const printfulOrder = {
    recipient,
    items: printfulItems,
    confirm: false,
  };

  const printfulRes = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(printfulOrder),
  });

  const printfulJson = await printfulRes.json();

  if (!printfulRes.ok) {
    console.error('Printful order failed:', printfulJson);
    // In production: alert yourself (email/Slack) here so a paid order
    // never silently fails to print.
    return { statusCode: 500, body: 'Printful order failed' };
  }

  console.log('Printful order created:', printfulJson.result?.id);
  return { statusCode: 200, body: 'Order submitted to Printful' };
};
