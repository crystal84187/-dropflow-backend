const express = require(‘express’);
const cors = require(‘cors’);
const crypto = require(‘crypto’);

const app = express();
app.use(cors());
app.use(express.json());

const ALI_APP_KEY = process.env.ALI_KEY || ‘530644’;
const ALI_APP_SECRET = process.env.ALI_SECRET || ‘’;
const ALI_API_URL = ‘https://api-sg.aliexpress.com/sync’;

app.get(’/’, function(req, res) {
res.json({ status: ‘OK’ });
});

app.get(’/api/health’, function(req, res) {
res.json({ status: ‘online’, message: ‘DropFlow backend is running’ });
});

function computeSignature(secret, apiMethod, params) {
var sortedKeys = Object.keys(params).sort();
var strToSign = apiMethod;
for (var i = 0; i < sortedKeys.length; i++) {
var key = sortedKeys[i];
strToSign += key + params[key];
}
strToSign = secret + strToSign + secret;
return crypto.createHmac(‘sha256’, secret).update(strToSign, ‘utf8’).digest(‘hex’).toUpperCase();
}

app.get(’/api/aliexpress/search’, async function(req, res) {
var q = req.query.q;
var sort = req.query.sort || ‘default’;
var page = req.query.page || 1;
var limit = req.query.limit || 20;

if (!q) {
return res.status(400).json({ error: ‘Search query q is required’ });
}

try {
var apiMethod = ‘aliexpress.affiliate.product.query’;
var now = new Date();
var timestamp = now.getFullYear() + ‘-’ +
String(now.getMonth() + 1).padStart(2, ‘0’) + ‘-’ +
String(now.getDate()).padStart(2, ‘0’) + ’ ’ +
String(now.getHours()).padStart(2, ‘0’) + ‘:’ +
String(now.getMinutes()).padStart(2, ‘0’) + ‘:’ +
String(now.getSeconds()).padStart(2, ‘0’) + ‘.’ +
String(now.getMilliseconds()).padStart(3, ‘0’);

```
var params = {
  app_key: ALI_APP_KEY,
  timestamp: timestamp,
  sign_method: 'hmac-sha256',
  format: 'json',
  v: '2.0',
  keywords: q,
  page_no: String(page),
  page_size: String(limit),
  target_currency: 'USD',
  target_language: 'EN',
  tracking_id: 'dropflow'
};

if (sort === 'price_asc') params.sort = 'SALE_PRICE_ASC';
if (sort === 'price_desc') params.sort = 'SALE_PRICE_DESC';
if (sort === 'orders') params.sort = 'LAST_VOLUME_DESC';

params.sign = computeSignature(ALI_APP_SECRET, apiMethod, params);
params.method = apiMethod;

var qs = new URLSearchParams(params).toString();
var apiRes = await fetch(ALI_API_URL + '?' + qs);
var data = await apiRes.json();

var result = data && data.aliexpress_affiliate_product_query_response && data.aliexpress_affiliate_product_query_response.resp_result;

if (!result || result.resp_code !== 200) {
  return res.status(502).json({ error: 'AliExpress API error', detail: result ? result.resp_msg : 'Unknown', raw: data });
}

var products = result.result && result.result.products && result.result.products.product ? result.result.products.product : [];

var formatted = products.map(function(p) {
  return {
    productId: p.product_id,
    title: p.product_title,
    imageUrl: p.product_main_image_url,
    price: p.target_sale_price || p.target_original_price,
    originalPrice: p.target_original_price,
    currency: p.target_sale_price_currency || 'USD',
    orders: p.lastest_volume || 0,
    rating: p.evaluate_rate,
    url: p.promotion_link || p.product_detail_url,
    shop: p.shop_name
  };
});

res.json({ products: formatted, total: result.result.total_record_count || formatted.length });
```

} catch (err) {
console.error(‘Search error:’, err);
res.status(500).json({ error: ‘Internal server error’, detail: err.message });
}
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
console.log(’DropFlow backend running on port ’ + PORT);
});
