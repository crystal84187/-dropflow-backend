
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(require('cors')());
app.use(express.json());

// ── CONFIG ──────────────────────────────────────────────
const ALIEXPRESS_APP_KEY = process.env.ALI_KEY       || '530644';
const ALIEXPRESS_APP_SECRET = process.env.ALI_SECRET || '';
const ALIEXPRESS_API_URL   = 'https://api-sg.aliexpress.com/sync';

// ── HEALTH CHECK ─────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'OK' }));
app.get('/api/health', (req, res) => res.json({ status: 'online', message: 'DropFlow backend is running' }));

// ── ALIEXPRESS SIGNATURE HELPER ───────────────────────────
function signRequest(params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  const str = secret + sorted + secret;
  return crypto.createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
}

// ── ALIEXPRESS PRODUCT SEARCH ─────────────────────────────
app.get('/api/aliexpress/search', async (req, res) => {
  const { q, sort = 'default', page = 1, limit = 20 } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query (q) is required' });
  }

  try {
    const timestamp = Date.now().toString();

    const params = {
      method: 'aliexpress.affiliate.product.query',
      app_key: ALIEXPRESS_APP_KEY,
      timestamp,
      sign_method: 'hmac-sha256',
      format: 'json',
      v: '2.0',
      keywords: q,
      page_no: String(page),
      page_size: String(limit),
      target_currency: 'USD',
      target_language: 'EN',
      tracking_id: 'dropflow',
    };

    // Add sort if specified
    if (sort === 'price_asc') params.sort = 'SALE_PRICE_ASC';
    if (sort === 'price_desc') params.sort = 'SALE_PRICE_DESC';
    if (sort === 'orders') params.sort = 'LAST_VOLUME_DESC';

    // Sign the request
    params.sign = signRequest(params, ALIEXPRESS_APP_SECRET);

    // Build query string
    const qs = new URLSearchParams(params).toString();
    const apiRes = await fetch(`${ALIEXPRESS_API_URL}?${qs}`);
    const data = await apiRes.json();

    // Parse AliExpress response
    const result = data?.aliexpress_affiliate_product_query_response?.resp_result;

    if (!result || result.resp_code !== 200) {
      console.error('AliExpress API error:', result);
      return res.status(502).json({
        error: 'AliExpress API error',
        detail: result?.resp_msg || 'Unknown error',
        raw: data
      });
    }

    const products = result.result?.products?.product || [];

    const formatted = products.map(p => ({
      productId: p.product_id,
      title: p.product_title,
      imageUrl: p.product_main_image_url,
      price: p.target_sale_price || p.target_original_price,
      originalPrice: p.target_original_price,
      currency: p.target_sale_price_currency || 'USD',
      orders: p.lastest_volume || 0,
      rating: p.evaluate_rate,
      url: p.promotion_link || p.product_detail_url,
      shop: p.shop_name,
    }));

    res.json({ products: formatted, total: result.result?.total_record_count || formatted.length });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── START SERVER ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DropFlow backend running on port ${PORT}`));
