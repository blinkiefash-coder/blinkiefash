const express = require('express')
const cors = require('cors')
const app = express()
app.use(cors())
app.use(express.json())
// Login API
app.post('/login', (req, res) => {
 const { email, password } = req.body
 if (email === "test@gmail.com" && password === "1234") {
   res.json({ success: true })
 } else {
   res.json({ success: false })
 }
})
app.listen(5000, () => {
 console.log('Server running on port 5000')
})