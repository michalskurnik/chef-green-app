const crypto = require('crypto');
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
async function getAccessToken() {
  const creds = Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64');
  const r = await fetch(PAYPAL_BASE+'/v1/oauth2/token',{method:'POST',headers:{'Authorization':'Basic '+creds,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  return (await r.json()).access_token;
}
module.exports = async function(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS')return res.status(200).end();
  try{
    const {packageId}=req.body;
    const pkgs={'dinner':{amount:'35.00',name:'ארוחות ערב'},'breakfast':{amount:'35.00',name:'ארוחות בוקר'}};
    if(!pkgs[packageId])return res.status(400).json({error:'Invalid package'});
    const token=await getAccessToken();
    const r=await fetch(PAYPAL_BASE+'/v2/checkout/orders',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{amount:{currency_code:'ILS',value:pkgs[packageId].amount},custom_id:packageId}]})});
    const order=await r.json();
    if(order.id)return res.status(200).json({orderId:order.id});
    return res.status(500).json({error:'Failed',details:order});
  }catch(e){return res.status(500).json({error:e.message});}
};
