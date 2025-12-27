
// tsx usually runs in environment with fetch.
// Actually Node 20 has fetch.

async function testCheckout() {
    console.log('Testing Stripe Checkout API...')
    try {
        const res = await fetch('http://localhost:3004/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 10 }),
        })

        if (!res.ok) {
            console.error('Failed to create checkout session:', res.status, res.statusText)
            const text = await res.text()
            console.error('Response:', text)
            return
        }

        const data = await res.json()
        console.log('Checkout Session Created Successfully!')
        console.log('URL:', data.url)
    } catch (error) {
        console.error('Error during checkout test:', error)
    }
}

testCheckout()
