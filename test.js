const fs = require('fs') //✓
const _ = require('underscore')
const express = require('express')

const app = express()

const port = 5555

const lib = fs.readFileSync('./readme.md', 'utf-8')

const filter = _.filter

app.listen(port,  () => console.log(`TEST: live http on ${port}`))