const express = require('express') //✓

const app = express()

const port = 5555

app.listen(port,  () => console.log(`TEST: live http on ${port}`)) //✓ //✓ => -->> () =>