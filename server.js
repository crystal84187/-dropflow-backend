const express = require('express');
const cors = require('cors');
const axios = require('axios');


const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ALI_KEY = process.env.ALI_KEY;
const ALI_SECRET = process.env.ALI_SECRET;
const TIKTOK_KEY = process.env.TIKTOK_KEY;
const TIKTOK_SECRET = process.env.TIKTOK_SECRET;

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'DropFlow backend running!' });
});

// Get TikTok orders
app.get('/orders', async (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = '/api/orders/search';
    const body = { page_size: 20 };
    const bodyStr = JSON.stringify(body);
    const signStr = TIKTOK_SECRET + path + 'app_key' + TIKTOK_KEY + 'timestamp' + timestamp + TIKTOK_SECRET;
    const sign = crypto.createHmac('sha256', TIKTOK_SECRET).update(signStr).digest('hex');
    const response = await axios.post(
      `https://open-api.tiktokglobalshop.com${path}?app_key=${TIKTOK_KEY}&timestamp=${timestamp}&sign=${sign}`,
      body,
      { headers: { 'Content-Type': 'application/json',​​​​​​​​​​​​​​​​
