/**
 * fulfill-order.js
 * ---------------------------------------------------------------
 * Stripe webhook -> Printful order bridge.
 *
 * This is the "glue" function GitHub Pages can't run on its own.
 * Flow:
 *   1. Stripe fires a webhook the moment a checkout succeeds.
 *   2. This function verifies the webhook is really from Stripe.
 *   3. It reads which product was bought off the session's metadata
 *      (set by create-checkout-session.js when the session was created)
 *      and looks it up in product-config.js to know which Printful
 *      variant(s) + image(s) to print.
 *   4. It pulls the buyer's shipping address from the Stripe session.
 *   5. It submits an order to the Printful API so the print gets made
 *      and shipped — no manual step on your end.
 *
 * WHERE TO RUN THIS
 * GitHub Pages only serves static files, it can't run this code. Deploy
 * this function (and create-checkout-session.js) on Netlify (recommended
 * — it can host your static pages from this same GitHub repo AND run
 * both functions in one deploy) or Vercel/Cloudflare Workers with minor
 * syntax tweaks. See README.md.
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
const { PRODUCTS } = require('./product-config');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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

  // ---- 2. Pull full session details (shipping address + our product key) ----
  const fullSession = await stripe.checkout.sessions.retrieve(session.id);

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

  // ---- 3. Look up what was bought via the metadata create-checkout-session.js set ----
  const productKey = fullSession.metadata?.product;
  const product = PRODUCTS[productKey];

  if (!product) {
    console.error(
      `No product-config.js entry for product key "${productKey}" — order needs manual handling.`,
      session.id
    );
    return { statusCode: 200, body: 'Unknown product — needs manual fulfillment' };
  }

  // A "bundle" product (the series funnel) becomes multiple Printful line
  // items; everything else is just itself as a single-item array.
  const printfulItems = (product.bundle || [product]).map((item) => ({
    variant_id: item.variant_id,
    quantity: 1,
    files: [{ url: item.image_url }],
  }));

  // ---- 4. Submit the order to Printful ----
  // confirm: false creates a DRAFT order you approve in the Printful
  // dashboard before it prints — good while you're testing. Switch to
  // true once you trust the pipeline end to end, so orders print
  // automatically.
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
