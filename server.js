const express = require('express');
const app = express();

app.use(require('cors')());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'DropFlow running!' });
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server started');
});​​​​​​​​​​​​​​​​
