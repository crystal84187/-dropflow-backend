const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const app = express();
app.use(cors());
app.use(express.json());

const ALI_APP_KEY = process.env.ALI_KEY || '530644';
const ALI_APP_SECRET = process.env.ALI_SECRET || '';

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
  var shanghai = new Date(now.getTime() + 8 * 60 * 60000);
  var y = shanghai.getUTCFullYear();
  var mo = String(shanghai.getUTCMonth() + 1).padStart(2, '0');
  var d = String(shanghai.getUTCDate()).padStart(2, '0');
  var h = String(shanghai.getUTCHours()).padStart(2, '0');
  var mi = String(shanghai.getUTCMinutes()).padStart(2, '0');
  var s = String(shanghai.getUTCSeconds()).padStart(2, '0');
  return y + '-' + mo + '-' + d + ' ' + h + ':' + mi + ':' + s;
}

function httpsPost(hostname, path, postData) {
  return new Promise(function(resolve, reject) {
    var body = querystring.stringify(postData);
    var options = {
      hostname: hostname,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    var req = https.request(options, function(resp) {
      var data = '';
      resp.on('data', function(chunk) { data += chunk; });
      resp.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
      method: 'aliexpress.dropshipping.product.search',
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
      ship_to_country: 'US'
    };

    if (sort === 'price_asc') params.sort_by = 'PRICE_ASC';
    if (sort === 'price_desc') params.sort_by = 'PRICE_DESC';
    if (sort === 'orders') params.sort_by = 'SALE_DESC';

    params.sign = signRequest(params, ALI_APP_SECRET);

    var data = await httpsPost('api-sg.aliexpress.com', '/sync', params);
    console.log('AliExpress response:', JSON.stringify(data).slice(0, 500));

    // Handle any response format
    var respKey = Object.keys(data)[0];
    var inner = data[respKey];

    if (!inner || inner.error_response) {
      return res.status(502).json({
        error: 'AliExpress API error',
        detail: (inner && inner.error_response && inner.error_response.msg) || 'Unknown error',
        raw: data
      });
    }

    var result = inner.result || inner.resp_result && inner.resp_result.result || inner;
    var products = [];

    if (result.products) {
      var p = result.products;
      products = p.product || p.traffic_product_d_t_o || p.aeop_tp_product || [];
    }

    var formatted = products.map(function(p) {
      return {
        productId: p.product_id,
        title: p.product_title || p.subject,
        imageUrl: p.product_main_image_url || p.image_u_r_l,
        price: p.target_sale_price || p.sale_price || p.original_price,
        originalPrice: p.target_original_price || p.original_price,
        currency: 'USD',
        orders: p.lastest_volume || p.orders || 0,
        rating: p.evaluate_rate || p.avg_star,
        url: p.product_detail_url || p.promotion_link,
        shop: p.shop_name
      };
    });

    res.json({
      products: formatted,
      total: result.total_record_count || formatted.length,
      debug: respKey
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
