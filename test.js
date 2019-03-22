const _ = require('underscore')
const express = require('express')

const app = express()

const port = 5555

const filter = _.filter

app.listen(port,  () => console.log(`TEST: live http on ${port}`))