(function(){
'use strict';
const $ = id => document.getElementById(id);
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const parts = s => s.split('-').map(Number);
const toX = s => { const [y,m,d] = parts(s); return y + (m-1)/12 + (d-1)/365; };
const niceDate = s => { const [y,m] = parts(s); return MON[m-1] + ' ' + y; };
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = v => v>=1e15 ? (v/1e15).toFixed(1)+'Q' : v>=1e12 ? (v/1e12).toFixed(v>=1e13?0:1)+'T' : v>=1e9 ? (v/1e9).toFixed(v>=1e10?0:1)+'B' : (v/1e6).toFixed(0)+'M';
const fmtLong = v => v>=1e15 ? (v/1e15).toFixed(1)+' quadrillion' : v>=1e12 ? (v/1e12).toFixed(v>=1e13?0:1)+' trillion' : v>=1e9 ? (v/1e9).toFixed(v>=1e10?0:1)+' billion' : Math.round(v/1e6)+' million';
const pctRest = a => { const r = 100 - a; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const yearTick = v => Number.isInteger(v) ? String(v) : '';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function toWordsPerDay(p, W){
  switch(p.unit){
    case 'words/day': return p.value;
    case 'tokens/day': return p.value*W;
    case 'tokens/minute': return p.value*1440*W;
    case 'tokens/week': return p.value/7*W;
    case 'tokens/month': return p.value/30.4*W;
    default: return p.value*W;
  }
}
const disclosed = p => fmtLong(p.value)+' '+p.unit.replace('/', ' per ')+(p.note?' ('+p.note+')':'');

let DATA;
function prepare(raw){
  const W = raw.wordsPerToken;
  raw.volume.forEach(s => {
    s.points.forEach(p => { p.x = toX(p.date); p.v = toWordsPerDay(p, W); p.disp = disclosed(p); p.when = niceDate(p.date); });
    s.points.sort((a,b)=>a.x-b.x);
  });
  return raw;
}
function latestLeader(){
  let best=null, src=null;
  DATA.volume.forEach(s => { const l = s.points[s.points.length-1]; if(!best || l.v > best.v){ best=l; src=s; } });
  return {best, src, short: src.label.split(' (')[0]};
}

/* ---------- shared: last checked ---------- */
function renderChecked(){
  const d = new Date(DATA.lastChecked+'T00:00:00');
  const txt = 'Data last checked: ' + d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  document.querySelectorAll('[data-last-checked]').forEach(el => el.textContent = txt);
}

/* ---------- home: live counters ---------- */
function startCounters(){
  if(!$('aiCount')) return;
  const H = DATA.humanWordsPerDay, {best, src, short} = latestLeader();
  const pct = Math.min(100, best.v/H*100);
  $('aiLabel').textContent = `Words processed by ${short}'s AI so far today`;
  $('racePct').textContent = 'about ' + pct.toFixed(0) + '%';
  $('raceTrack').setAttribute('aria-label', `${short}'s AI word volume is about ${pct.toFixed(0)} percent of human daily word output`);
  requestAnimationFrame(()=>{ $('raceFill').style.width = pct.toFixed(1)+'%'; });
  const nf = new Intl.NumberFormat('en-US');
  const tick = () => {
    const now = new Date();
    const frac = (now.getUTCHours()*3600 + now.getUTCMinutes()*60 + now.getUTCSeconds() + now.getUTCMilliseconds()/1000)/86400;
    $('aiCount').textContent = nf.format(Math.floor(best.v*frac));
    $('humanCount').textContent = nf.format(Math.floor(H*frac));
  };
  tick();
  if(!reduceMotion) setInterval(tick, 100); else setInterval(tick, 5000);
}

/* ---------- charts ---------- */
const markers = {
  id:'markers',
  beforeDatasetsDraw(chart, args, opts){
    const {ctx, chartArea:a, scales:{x}} = chart;
    ctx.save();
    ctx.font = '500 12px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillStyle = css('--muted'); ctx.strokeStyle = css('--rule'); ctx.setLineDash([3,3]);
    (opts.list||[]).forEach(e => {
      const px = x.getPixelForValue(e.x);
      if(px<a.left||px>a.right) return;
      ctx.beginPath(); ctx.moveTo(px,a.top); ctx.lineTo(px,a.bottom); ctx.stroke();
      ctx.save(); ctx.translate(px+5, a.top+6); ctx.rotate(Math.PI/2); ctx.textBaseline='bottom'; ctx.fillText(e.label,0,0); ctx.restore();
    });
    ctx.restore();
  }
};
let volume, share;
function buildCharts(){
  if(!$('volume') || typeof Chart === 'undefined') return;
  const muted = css('--muted'), rule = css('--rule'), H = DATA.humanWordsPerDay;
  Chart.defaults.color = muted;
  Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
  if(reduceMotion) Chart.defaults.animation = false;
  const events = DATA.events.map(e => ({x:toX(e.date), label:e.label}));
  const allX = DATA.volume.flatMap(s => s.points.map(p=>p.x));
  const xMax = Math.ceil((Math.max(...allX)+0.15)*4)/4;
  const yTop = Math.max(H, ...DATA.volume.flatMap(s=>s.points.map(p=>p.v)));
  const ds = DATA.volume.map(s => ({
    key:s.key, label:s.label, data:s.points.map(p=>({x:p.x,y:p.v,disp:p.disp,when:p.when})),
    borderColor:css(s.color)||css('--machine'), backgroundColor:css(s.color)||css('--machine'),
    borderWidth:s.key==='google'?3:2.25, pointRadius:4, pointHoverRadius:6, tension:0.25
  }));
  ds.push({key:'human', label:'All people (~'+fmt(H)+' words/day)', data:[{x:2022.5,y:H},{x:xMax,y:H}],
    borderColor:css('--human'), borderDash:[6,5], borderWidth:2, pointRadius:0, pointHoverRadius:0});
  const hidden = volume ? volume.data.datasets.map((d,i)=>!volume.isDatasetVisible(i)) : [];
  const logOn = $('btnLog').getAttribute('aria-pressed')==='true';
  if(volume) volume.destroy();
  volume = new Chart($('volume'), {
    type:'line', data:{datasets:ds},
    options:{
      maintainAspectRatio:false, animation:{duration:500},
      interaction:{mode:'nearest', intersect:false},
      plugins:{ legend:{display:false}, markers:{list:events},
        tooltip:{ filter:i=>i.dataset.key!=='human', padding:10, callbacks:{
          title:i=>i[0].raw.when+' · '+i[0].dataset.label,
          label:i=>['Disclosed: '+i.raw.disp, '≈ '+fmtLong(i.raw.y)+' words a day', '≈ '+(i.raw.y/H*100).toFixed(i.raw.y/H<0.01?3:1)+'% of human output']}}},
      scales:{
        x:{type:'linear', min:2022.5, max:xMax, grid:{color:rule}, border:{color:rule}, ticks:{stepSize:0.5, callback:yearTick, color:muted}},
        y:{type:logOn?'logarithmic':'linear', min:logOn?1e10:0, max:logOn?Math.pow(10,Math.ceil(Math.log10(yTop*1.5))):yTop*1.1,
           grid:{color:rule}, border:{color:rule}, title:{display:true,text:'words per day',color:muted},
           ticks:{color:muted, callback:v=>{ if(!logOn) return fmt(v); const l=Math.log10(v); return Math.abs(l-Math.round(l))<1e-6?fmt(v):''; }}}
      }
    },
    plugins:[markers]
  });
  hidden.forEach((h,i)=>{ if(h) volume.hide(i); });
  const lg = $('legend1');
  lg.innerHTML = volume.data.datasets.map((d,i)=>`<label for="lg${i}"><input type="checkbox" id="lg${i}" ${volume.isDatasetVisible(i)?'checked':''}><span class="sw ${d.key==='human'?'dash':''}" style="background:${d.borderColor}"></span>${esc(d.label)}</label>`).join('');
  lg.querySelectorAll('input').forEach((el,i)=>el.addEventListener('change',()=>{ el.checked?volume.show(i):volume.hide(i); }));

  if(!$('share')) return;
  const ai = DATA.webShare.points.map(p=>({x:toX(p.date), y:p.ai, when:niceDate(p.date)}));
  if(share) share.destroy();
  share = new Chart($('share'), {
    type:'line',
    data:{datasets:[
      {label:'Mostly AI-written', data:ai, borderColor:css('--machine'), backgroundColor:css('--machine-soft'), fill:'origin', borderWidth:2.5, pointRadius:4, tension:0.3},
      {label:'Human-written', data:ai.map(p=>({x:p.x,y:100})), borderColor:'transparent', backgroundColor:css('--human-soft'), fill:'-1', pointRadius:0, pointHoverRadius:0}
    ]},
    options:{ maintainAspectRatio:false, animation:{duration:500},
      interaction:{mode:'nearest',intersect:false},
      plugins:{ legend:{labels:{color:muted, boxWidth:14}}, markers:{list:events.slice(0,2)},
        tooltip:{filter:i=>i.datasetIndex===0, padding:10, callbacks:{
          title:i=>i[0].raw.when, label:i=>[`Mostly AI-written: ~${i.raw.y}%`,`Human-written: ~${pctRest(i.raw.y)}%`]}}},
      scales:{
        x:{type:'linear',min:2022.5,max:Math.max(...ai.map(p=>p.x))+0.25,grid:{color:rule},border:{color:rule},ticks:{stepSize:0.5,callback:yearTick,color:muted}},
        y:{min:0,max:100,grid:{color:rule},border:{color:rule},ticks:{stepSize:25,callback:v=>v+'%',color:muted},title:{display:true,text:'share of new articles',color:muted}}
      }
    },
    plugins:[markers]
  });
}
function wireScale(){
  if(!$('btnLog')) return;
  const set = log => { $('btnLog').setAttribute('aria-pressed', String(log)); $('btnLin').setAttribute('aria-pressed', String(!log)); buildCharts(); };
  $('btnLog').addEventListener('click',()=>set(true));
  $('btnLin').addEventListener('click',()=>set(false));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', buildCharts);
}

/* ---------- data page ---------- */
let filter = 'all';
function renderTable(){
  if(!$('rows')) return;
  const H = DATA.humanWordsPerDay;
  const rows = [];
  DATA.volume.forEach(s => s.points.forEach(p => rows.push({...p, src:s.label, key:s.key, color:css(s.color)})));
  rows.sort((a,b)=>b.x-a.x);
  const shown = rows.filter(r => filter==='all' || r.key===filter);
  $('rows').innerHTML = shown.map(r =>
    `<tr><td class="num">${esc(r.when)}</td><td><span class="dot" style="background:${r.color}"></span>${esc(r.src)}</td><td><a href="${esc(r.source)}" rel="noopener">${esc(r.disp)}</a></td><td class="n">${fmtLong(r.v)}</td><td class="n">${(r.v/H*100).toFixed(r.v/H<0.01?2:1)}%</td></tr>`).join('');
  $('dataSummary').textContent = `${rows.length} disclosures from ${DATA.volume.length} sources, newest first. Human baseline: about ${fmtLong(H)} words a day.`;
  if(!$('filters').children.length){
    const opts = [['all','All sources']].concat(DATA.volume.map(s=>[s.key, s.label.split(' (')[0]]));
    $('filters').innerHTML = opts.map(([k,l])=>`<button class="chip" data-k="${esc(k)}" aria-pressed="${k===filter}">${esc(l)}</button>`).join('');
    $('filters').addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      filter = b.dataset.k;
      $('filters').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed', String(x.dataset.k===filter)));
      renderTable();
    });
  }
  if($('shareRows')) $('shareRows').innerHTML = DATA.webShare.points.slice().reverse().map(p =>
    `<tr><td>${niceDate(p.date)}</td><td class="n">~${p.ai}%</td><td class="n">~${pctRest(p.ai)}%</td></tr>`).join('');
}

/* ---------- boot ---------- */
const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
fetch('/data.json', {cache:'no-cache'})
  .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(raw => { DATA = prepare(raw); renderChecked(); startCounters(); renderTable(); return fontsReady; })
  .then(() => { wireScale(); buildCharts(); })
  .catch(err => {
    const msg = 'The data file did not load (' + err.message + '). Reload the page to try again.';
    if($('dataSummary')) $('dataSummary').textContent = msg;
    document.querySelectorAll('.chart').forEach(c => c.insertAdjacentHTML('afterbegin', `<p class="small" style="padding:16px">${esc(msg)}</p>`));
  });
})();
