import crypto from 'crypto';

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

function generateToken(packageId) {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
  const payload = `${packageId}:${expires}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
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
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Missing orderId' });
    }

    const accessToken = await getAccessToken();

    // Capture the payment
    const captureRes = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const capture = await captureRes.json();

    if (capture.status === 'COMPLETED') {
      // Get the package from the order
      const packageId = capture.purchase_units?.[0]?.custom_id || 'dinner';

      // Generate access token
      const accessTokenStr = generateToken(packageId);

      return res.status(200).json({
        success: true,
        packageId,
        accessToken: accessTokenStr,
      });
    } else {
      console.error('Capture failed:', capture);
      return res.status(400).json({ error: 'Payment not completed' });
    }

  } catch (err) {
    console.error('capture-order error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
