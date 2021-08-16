const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello from server!');
});

// Listen to the App Engine-specified port, or 9090 otherwise
const PORT = process.env.PORT || 9090;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});