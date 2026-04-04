const PAYPAL_BASE = process.env.PAYPAL_MODE === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

async function getAccessToken() {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { packageId, amount } = req.body;

    // Validate
    const validPackages = {
      'dinner': { amount: '35.00', name: 'ארוחות ערב שילדים אוהבים' },
      'breakfast': { amount: '35.00', name: 'ארוחות בוקר שילדים אוהבים' },
    };

    const pkg = validPackages[packageId];
    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package' });
    }

    const accessToken = await getAccessToken();

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'ILS',
            value: pkg.amount,
          },
          description: pkg.name,
          custom_id: packageId,
        }],
        application_context: {
          brand_name: 'השף הירוק',
          locale: 'he-IL',
          user_action: 'PAY_NOW',
        },
      }),
    });

    const order = await orderRes.json();

    if (order.id) {
      return res.status(200).json({ orderId: order.id });
    } else {
      console.error('PayPal order error:', order);
      return res.status(500).json({ error: 'Failed to create order' });
    }

  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
