const crypto = require('crypto');
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
async function getAccessToken() {
  const creds = Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64');
  const r = await fetch(PAYPAL_BASE+'/v1/oauth2/token',{method:'POST',headers:{'Authorization':'Basic '+creds,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  return (await r.json()).access_token;
}
function generateToken(packageId) {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  const expires = Date.now() + 1000*60*60*24*30;
  const payload = packageId+':'+expires;
  const sig = crypto.createHmac('sha256',secret).update(payload).digest('hex');
  return Buffer.from(payload+':'+sig).toString('base64url');
}
module.exports = async function(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const orderId = body && body.orderId;
    if(!orderId)return res.status(400).json({error:'Missing orderId'});
    const token=await getAccessToken();
    const r=await fetch(PAYPAL_BASE+'/v2/checkout/orders/'+orderId+'/capture',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}});
    const capture=await r.json();
    if(capture.status==='COMPLETED'){
      const packageId=capture.purchase_units?.[0]?.custom_id||'dinner';
      return res.status(200).json({success:true,packageId,accessToken:generateToken(packageId)});
    }
    return res.status(400).json({error:'Payment not completed',details:capture});
  }catch(e){return res.status(500).json({error:e.message});}
};
