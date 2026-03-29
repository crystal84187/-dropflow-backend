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
  var page = req.query.page || '1';
  var limit = req.query.limit || '20';

  if (!q) {
    return res.status(400).json({ error: 'Search query q is required' });
  }

  try {
    var params = {
      method: 'aliexpress.ds.text.search',
      app_key: ALI_APP_KEY,
      sign_method: 'md5',
      timestamp: getTimestamp(),
      format: 'json',
      v: '2.0',
      search_word: q,
      page_index: String(page),
      page_size: String(limit),
      currency: 'USD',
      target_language: 'EN',
      countryCode: 'US'
    };

    params.sign = signRequest(params, ALI_APP_SECRET);
    var data = await httpsPost('api-sg.aliexpress.com', '/sync', params);
    console.log('AliExpress response:', JSON.stringify(data).slice(0, 800));

    res.json({ raw: data });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('DropFlow backend running on port ' + PORT);
});
