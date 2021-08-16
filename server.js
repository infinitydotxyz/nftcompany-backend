const express = require('express')
const app = express();
app.use(express.json())

const utils = require("./utils")

app.get('/', (req, res) => {
    res.send('Hello from server!')
});

// Listen to the App Engine-specified port, or 9090 otherwise
const PORT = process.env.PORT || 9090;
app.listen(PORT, () => {
    utils.log(`Server listening on port ${PORT}...`)
});

app.get('/explore', (req, res) => {
    res.send('Explore')
});

app.get('/preview/:item', (req, res) => {
    res.send('Preview')
});

app.get('/u/:user/items', (req, res) => {
    res.send('User items')
});

app.get('/u/:user/item', (req, res) => {
    res.send('User item ' +  req.params.user)
});