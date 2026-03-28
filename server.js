const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const ALI_APP_KEY = process.env.ALI_KEY || '530644';
const ALI_APP_SECRET = process.env.ALI_SECRET || '';

// Use the legacy Taobao gateway which works with Drop Shipping apps
const ALI_API_URL = 'https://gw.api.taobao.com/router/rest';

app.get('/', function(req, res) {
  res.json({ status: 'OK' });
});

app.get('/api/health', function(req, res) {
  res.json({ status: 'online', message: 'DropFlow backend is running' });
});

function signRequest(params, secret) {
  var keys = Object.keys(params).sort();
  var str = '';
  for (var i = 0; i < keys.length; i++) {
    str += keys[i] + params[keys[i]];
  }
  str = secret + str + secret;
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

function getTimestamp() {
  var now = new Date();
  var offset = 8 * 60;
  var shanghai = new Date(now.getTime() + offset * 60000);
  var y = shanghai.getUTCFullYear();
  var mo = String(shanghai.getUTCMonth() + 1).padStart(2, '0');
  var d = String(shanghai.getUTCDate()).padStart(2, '0');
  var h = String(shanghai.getUTCHours()).padStart(2, '0');
  var mi = String(shanghai.getUTCMinutes()).padStart(2, '0');
  var s = String(shanghai.getUTCSeconds()).padStart(2, '0');
  return y + '-' + mo + '-' + d + ' ' + h + ':' + mi + ':' + s;
}

app.get('/api/aliexpress/search', async function(req, res) {
  var q = req.query.q;
  var sort = req.query.sort || 'default';
  var page = req.query.page || '1';
  var limit = req.query.limit || '20';

  if (!q) {
    return res.status(400).json({ error: 'Search query q is required' });
  }

  try {
    var params = {
      method: 'aliexpress.affiliate.product.query',
      app_key: ALI_APP_KEY,
      sign_method: 'md5',
      timestamp: getTimestamp(),
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

    params.sign = signRequest(params, ALI_APP_SECRET);

    var apiRes = await fetch(ALI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params)
    });

    var data = await apiRes.json();
    console.log('AliExpress response:', JSON.stringify(data).slice(0, 400));

    var result = data && data.aliexpress_affiliate_product_query_response && data.aliexpress_affiliate_product_query_response.resp_result;

    if (!result || result.resp_code !== 200) {
      return res.status(502).json({
        error: 'AliExpress API error',
        detail: (result && result.resp_msg) || 'Unknown error',
        raw: data
      });
    }

    var products = (result.result && result.result.products && result.result.products.product) || [];

    var formatted = products.map(function(p) {
      return {
        productId: p.product_id,
        title: p.product_title,
        imageUrl: p.product_main_image_url,
        price: p.target_sale_price || p.target_original_price,
        originalPrice: p.target_original_price,
        currency: 'USD',
        orders: p.lastest_volume || 0,
        rating: p.evaluate_rate,
        url: p.promotion_link || p.product_detail_url,
        shop: p.shop_name
      };
    });

    res.json({
      products: formatted,
      total: (result.result && result.result.total_record_count) || formatted.length
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('DropFlow backend running on port ' + PORT);
});
