const express = require('express');
const app = express();
app.use(require('cors')());
app.use(express.json());
app.get('/', function(req, res) {
  res.json({ status: 'OK' });
});
app.listen(process.env.PORT || 3000);
