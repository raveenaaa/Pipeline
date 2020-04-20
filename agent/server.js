const express = require('express')
const app = express()
const port = 3001
const host = 'localhost';

app.get('/', (req, res) => res.send('Server is running...'));

app.listen(port, () => console.log(`Example app listening at http://${host}:${port}`))