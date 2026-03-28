const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const ALI_APP_KEY = process.env.ALI_KEY || '530644';
const ALI_APP_SECRET = process.env.ALI_SECRET || '';
const ALI_API_URL = 'https://api-sg.aliexpress.com/sync';

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
  return crypto.createHash('md5').update(str, 'utf8').digest('h
