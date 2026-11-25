// ── Station keys ──────────────────────────────────────────────
var STATION_KEYS=['station1_completed','station2_completed','station3_completed',
                  'station4_completed','station5_completed'];
var LEGACY_KEYS=['recipe1_completed','recipe2_completed','recipe3_completed',
                 'recipe4_completed','recipe5_completed'];

// ── Skip all ──────────────────────────────────────────────────
function skipAllAndContinue(){
  STATION_KEYS.forEach(function(k){localStorage.setItem(k,'1');});
  LEGACY_KEYS.forEach(function(k){localStorage.setItem(k,'1');});
  localStorage.setItem('dinner_stars_detail',JSON.stringify([5,5,5,5,4]));
  document.getElementById('skip-overlay').style.display='none';
}

// ── Guard ─────────────────────────────────────────────────────
(function(){
  var done=STATION_KEYS.filter(function(k,i){
    return localStorage.getItem(k)==='1'||localStorage.getItem(LEGACY_KEYS[i])==='1';
  }).length;
  if(done<5){
    document.getElementById('skip-overlay').style.display='flex';
  }
})();

// ── Sparkles ──────────────────────────────────────────────────
(function(){
  var c=document.getElementById('sparkles');
  var cols=['#F7C948','#FFD54F','#FF8F00','#4CAF50','#FFCA28'];
  for(var i=0;i<12;i++){
    var s=document.createElement('div');
    s.className='sp';
    var size=(Math.random()*6+4)+'px';
    s.style.cssText=[
      'width:'+size,'height:'+size,
      'top:'+Math.random()*100+'%',
      'left:'+Math.random()*100+'%',
      'background:'+cols[Math.floor(Math.random()*cols.length)],
      'animation-duration:'+(3+Math.random()*4)+'s',
      'animation-delay:'+(Math.random()*5)+'s',
      'opacity:0'
    ].join(';');
    c.appendChild(s);
  }
})();

// ── CTA actions ───────────────────────────────────────────────
function sendPhoto(){
  var msg=encodeURIComponent('הנה ארוחת הערב שהכנו עם השף הירוק! 🍽️✨');
  window.open('https://wa.me/972547826788?text='+msg,'_blank');
}

function downloadRecipes(){
  // The PDF used to be inlined here as a 1MB base64 string that was parsed
  // on every visit to the final screen; now it is fetched only on tap.
  fetch('/assets/dinner-recipes.pdf').then(function(r){return r.blob();}).then(function(blob){
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download='מתכוני_השף_הירוק.pdf';
    document.body.appendChild(a);a.click();
    document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},1000);
  });
}

function goHub(){
  window.location.href='index.html';
}

function replay(){
  if(confirm('לאפס את ההרפתקה ולהתחיל מחדש?')){
    STATION_KEYS.concat(LEGACY_KEYS).forEach(function(k){localStorage.removeItem(k);});
    localStorage.removeItem('dinner_stars_detail');
    window.location.href='index.html';
  }
}