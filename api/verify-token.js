import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, packageId } = req.body;

    if (!token) {
      return res.status(401).json({ valid: false, error: 'No token' });
    }

    const secret = process.env.ACCESS_TOKEN_SECRET;
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');

    if (parts.length !== 3) {
      return res.status(401).json({ valid: false, error: 'Invalid token format' });
    }

    const [tokenPackageId, expires, sig] = parts;

    // Check expiry
    if (Date.now() > parseInt(expires)) {
      return res.status(401).json({ valid: false, error: 'Token expired' });
    }

    // Verify signature
    const payload = `${tokenPackageId}:${expires}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (sig !== expectedSig) {
      return res.status(401).json({ valid: false, error: 'Invalid token' });
    }

    // Check package matches
    if (packageId && tokenPackageId !== packageId) {
      return res.status(403).json({ valid: false, error: 'Wrong package' });
    }

    return res.status(200).json({ valid: true, packageId: tokenPackageId });

  } catch (err) {
    console.error('verify-token error:', err);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}
