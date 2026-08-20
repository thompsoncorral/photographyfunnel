/**
 * product-config.js
 * ---------------------------------------------------------------
 * Single source of truth for every sellable offer across all four
 * funnels (single-photo, series, horse, wave).
 *
 * Both functions import this file:
 *   - create-checkout-session.js reads price_id + return_path to
 *     start a purchase.
 *   - fulfill-order.js reads variant_id / bundle + image_url to know
 *     what to print and ship once a purchase completes.
 *
 * Each offer is defined here ONCE, under a short "product key" (e.g.
 * "horse-upsell") — that same key is what each page's Buy button sends
 * to create-checkout-session.js, and what gets stored in the Stripe
 * Checkout Session's metadata so fulfill-order.js can look it back up.
 * No more copy-pasting Stripe Payment Link URLs into HTML, and no more
 * keeping a separate price-ID map in sync by hand.
 *
 * EDIT ME: for each product below —
 *   1. price_id: the Stripe Price ID (starts with "price_") from the
 *      Product you create in Stripe Dashboard > Product catalog.
 *   2. variant_id: the Printful variant ID for that canvas size
 *      (Printful Dashboard > when you add the product, shown per size).
 *   3. image_url: a PUBLIC, full-resolution URL of the image file —
 *      this is what Printful actually prints from. See README section 1.
 * "bundle" entries (the series funnel) list 3 of these instead of one,
 * since a single Checkout Session there buys 3 separate canvases —
 * fulfill-order.js turns each bundle entry into its own Printful line
 * item. The Stripe side still only needs ONE price_id per bundle offer
 * (one Stripe Product representing "the series"), so price_id is still
 * a single value even for bundles.
 * ---------------------------------------------------------------
 */
const PRODUCTS = {
  // ---- single-photo funnel ----
  'single-index': {
    price_id: 'price_REPLACE_SINGLE_PHOTO',
    variant_id: 0000,
    image_url: 'https://yourdomain.com/assets/img/print-ready/photo-1-fullres.jpg',
    label: 'Single photo — 16x20 canvas',
    return_path: '/single-photo/upsell.html',
  },
  'single-upsell': {
    price_id: 'price_REPLACE_SINGLE_UPSELL',
    variant_id: 0000, // "the other 2 photos" bundle — may need its own Printful setup, see README
    image_url: 'https://yourdomain.com/assets/img/print-ready/photo-2-fullres.jpg',
    label: 'Upsell — remaining 2 prints',
    return_path: '/single-photo/downsell.html',
  },
  'single-downsell': {
    price_id: 'price_REPLACE_SINGLE_DOWNSELL',
    variant_id: 0000,
    image_url: 'https://yourdomain.com/assets/img/print-ready/photo-2-fullres.jpg',
    label: 'Downsell — 1 additional print',
    return_path: '/single-photo/thank-you.html',
  },

  // ---- series funnel ----
  'series-index': {
    price_id: 'price_REPLACE_SERIES_BUNDLE',
    bundle: [
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-1-fullres.jpg' },
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-2-fullres.jpg' },
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-3-fullres.jpg' },
    ],
    label: 'Full 3-print series',
    return_path: '/series/upsell.html',
  },
  'series-upsell': {
    price_id: 'price_REPLACE_SERIES_UPSELL',
    bundle: [
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-1-fullres.jpg' }, // 24x36 variant
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-2-fullres.jpg' },
      { variant_id: 0000, image_url: 'https://yourdomain.com/assets/img/print-ready/photo-3-fullres.jpg' },
    ],
    label: 'Series size upgrade (all 3, 24x36)',
    return_path: '/series/downsell.html',
  },
  'series-downsell': {
    price_id: 'price_REPLACE_SERIES_DOWNSELL',
    variant_id: 0000, // single 24x36 variant for lead photo only
    image_url: 'https://yourdomain.com/assets/img/print-ready/photo-1-fullres.jpg',
    label: 'Series downsell — 1 print upgraded',
    return_path: '/series/thank-you.html',
  },

  // ---- horse funnel (standalone — never bundled with wave or any other photo) ----
  'horse-index': {
    price_id: 'price_REPLACE_HORSE',
    variant_id: 0000,
    image_url: 'https://yourdomain.com/assets/img/print-ready/horse-fullres.jpg',
    label: 'Horse print — 16x20 canvas',
    return_path: '/horse/upsell.html',
  },
  'horse-upsell': {
    price_id: 'price_REPLACE_HORSE_UPSELL',
    variant_id: 0000, // 24x36 variant
    image_url: 'https://yourdomain.com/assets/img/print-ready/horse-fullres.jpg',
    label: 'Horse upsell — size upgrade to 24x36',
    return_path: '/horse/downsell.html',
  },
  'horse-downsell': {
    price_id: 'price_REPLACE_HORSE_DOWNSELL',
    variant_id: 0000, // framed 16x20 variant
    image_url: 'https://yourdomain.com/assets/img/print-ready/horse-fullres.jpg',
    label: 'Horse downsell — premium framing add-on',
    return_path: '/horse/thank-you.html',
  },

  // ---- wave funnel (standalone — never bundled with horse or any other photo) ----
  'wave-index': {
    price_id: 'price_REPLACE_WAVE',
    variant_id: 0000,
    image_url: 'https://yourdomain.com/assets/img/print-ready/wave-fullres.jpg',
    label: 'Wave print — 16x20 canvas',
    return_path: '/wave/upsell.html',
  },
  'wave-upsell': {
    price_id: 'price_REPLACE_WAVE_UPSELL',
    variant_id: 0000, // 24x36 variant
    image_url: 'https://yourdomain.com/assets/img/print-ready/wave-fullres.jpg',
    label: 'Wave upsell — size upgrade to 24x36',
    return_path: '/wave/downsell.html',
  },
  'wave-downsell': {
    price_id: 'price_REPLACE_WAVE_DOWNSELL',
    variant_id: 0000, // framed 16x20 variant
    image_url: 'https://yourdomain.com/assets/img/print-ready/wave-fullres.jpg',
    label: 'Wave downsell — premium framing add-on',
    return_path: '/wave/thank-you.html',
  },
};

module.exports = { PRODUCTS };
