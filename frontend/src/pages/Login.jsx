import { useState } from 'react'
import Home from './Home'
import './Login.css'

function Login() {
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [isLoggedIn, setIsLoggedIn] = useState(false)

const handleLogin = async (e) => {
 e.preventDefault()

const res = await fetch('http://localhost:5000/login', {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({ email, password })
})

const data = await res.json()

if (data.success) {
setIsLoggedIn(true)  // 👈 redirect to Home
} else {
alert('Invalid Credentials ❌')
}
}

// 👇 If logged in → show Home page
if (isLoggedIn) {
return <Home />
}

return (
<div className="login-container">
<div className="login-box">
<h2>Blinkiefash Login</h2>

<form onSubmit={handleLogin}>
<input
type="email"
placeholder="Enter email"
onChange={(e) => setEmail(e.target.value)}
/>

<input
type="password"
placeholder="Enter password"
onChange={(e) => setPassword(e.target.value)}
/>

<button type="submit">Login</button>
</form>
</div>
</div>
)
}

export default Login