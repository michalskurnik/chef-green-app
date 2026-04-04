const crypto = require('crypto');
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
async function getAccessToken() {
  const creds = Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64');
  const r = await fetch(PAYPAL_BASE+'/v1/oauth2/token',{method:'POST',headers:{'Authorization':'Basic '+creds,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  const data = await r.json();
  console.log('PayPal auth response:', JSON.stringify(data));
  return data.access_token;
}
module.exports = async function(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const packageId = body.packageId || 'dinner';
    console.log('Creating order for package:', packageId);
    const token = await getAccessToken();
    console.log('Got token:', token ? 'YES' : 'NO');
    const r = await fetch(PAYPAL_BASE+'/v2/checkout/orders',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{amount:{currency_code:'USD',value:'9.99'},custom_id:packageId}]})});
    const order = await r.json();
    console.log('Order response:', JSON.stringify(order));
    if(order.id)return res.status(200).json({orderId:order.id});
    return res.status(500).json({error:'Failed',details:order});
  }catch(e){
    console.error('Error:', e.message);
    return res.status(500).json({error:e.message});
  }
};
