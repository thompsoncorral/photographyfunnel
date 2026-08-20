/**
 * create-checkout-session.js
 * ---------------------------------------------------------------
 * Creates a Stripe EMBEDDED Checkout Session for whichever offer the
 * customer clicked "Buy" on, and hands back a client secret. Each
 * page's JavaScript uses that secret to mount Stripe's payment form
 * INLINE, right on the page — the customer never leaves your site or
 * sees a separate stripe.com checkout URL, but Stripe (not you) still
 * handles every card field, so you stay out of PCI scope.
 *
 * Called from the front end like:
 *   fetch('/.netlify/functions/create-checkout-session', {
 *     method: 'POST',
 *     body: JSON.stringify({ product: 'horse-index' }),
 *   })
 *
 * "product" must be a key from product-config.js — see that file for
 * the full list and for where to fill in real Stripe Price IDs.
 *
 * ENV VARS YOU MUST SET (same one fulfill-order.js uses)
 *   STRIPE_SECRET_KEY - from Stripe Dashboard > Developers > API keys
 *   (never put this in the HTML — only the separate PUBLISHABLE key,
 *   which is safe to expose, belongs client-side. See README section 3.)
 *
 * SETUP STEPS
 *   npm install stripe
 * ---------------------------------------------------------------
 */

const Stripe = require('stripe');
const { PRODUCTS } = require('./product-config');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let productKey;
  try {
    ({ product: productKey } = JSON.parse(event.body || '{}'));
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  const product = PRODUCTS[productKey];
  if (!product) {
    return { statusCode: 400, body: `Unknown product "${productKey}"` };
  }

  // Even "bundle" offers (the series funnel) are ONE Stripe Product/Price —
  // fulfill-order.js is what splits a bundle into multiple Printful line
  // items after payment. So checkout only ever needs this one line item.
  const line_items = [{ price: product.price_id, quantity: 1 }];

  const origin = event.headers.origin || `https://${event.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      line_items,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'], // EDIT ME: add every country you ship to
      },
      // Stored here so fulfill-order.js knows exactly what was bought
      // without having to reverse-engineer it from the Stripe Price ID.
      metadata: { product: productKey },
      // Stripe redirects the customer's browser here once payment
      // completes — point it at the NEXT page in this funnel, same as
      // the "after payment" redirect a Payment Link used to handle.
      return_url: `${origin}${product.return_path}?session_id={CHECKOUT_SESSION_ID}`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret: session.client_secret }),
    };
  } catch (err) {
    console.error('Failed to create checkout session:', err.message);
    return { statusCode: 500, body: 'Could not start checkout' };
  }
};
