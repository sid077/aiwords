(function(){
const MLABEL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const toX = s => { const [y,m,d] = s.split('-').map(Number); return y + (m-1)/12 + (d-1)/365; };
const niceDate = s => { const [y,m,d] = s.split('-').map(Number); return MLABEL[m-1]+' '+y; };
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt = v => v>=1e15 ? (v/1e15).toFixed(1)+'Q' : v>=1e12 ? (v/1e12).toFixed(v>=1e13?0:1)+'T' : v>=1e9 ? (v/1e9).toFixed(v>=1e10?0:1)+'B' : (v/1e6).toFixed(0)+'M';
const yearTick = v => Number.isInteger(v) ? String(v) : '';
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function toWordsPerDay(p, W){
  switch(p.unit){
    case 'words/day': return p.value;
    case 'tokens/day': return p.value*W;
    case 'tokens/minute': return p.value*60*24*W;
    case 'tokens/week': return p.value/7*W;
    case 'tokens/month': return p.value/30.4*W;
    default: return p.value*W;
  }
}
const dispUnit = p => fmt(p.value)+' '+p.unit+(p.note?' ('+p.note+')':'');

let DATA, volume, share;

function prepare(raw){
  const W = raw.wordsPerToken;
  raw.volume.forEach(s => s.points.forEach(p => { p.x = toX(p.date); p.v = toWordsPerDay(p, W); p.disp = dispUnit(p); p.when = niceDate(p.date); }));
  raw.volume.forEach(s => s.points.sort((a,b)=>a.x-b.x));
  return raw;
}

function renderStatic(){
  const H = DATA.humanWordsPerDay;
  const d = new Date(DATA.lastChecked+'T00:00:00');
  document.getElementById('checked').textContent = 'Data last checked: ' + d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) + ' · updated weekly';

  // KPI: largest latest value across sources
  let best = null, bestSrc = null;
  DATA.volume.forEach(s => { const last = s.points[s.points.length-1]; if(!best || last.v > best.v){ best = last; bestSrc = s; } });
  const pct = Math.min(100, best.v/H*100);
  document.getElementById('kpiLabel').textContent = 'Largest single disclosure · ' + bestSrc.label.split(' (')[0] + ', ' + best.when;
  document.getElementById('kpiAI').textContent = '~' + fmt(best.v);
  document.getElementById('kpiFill').style.width = pct.toFixed(1)+'%';
  document.getElementById('kpiPct').textContent = bestSrc.label.split(' (')[0] + ' alone ≈ ' + pct.toFixed(0) + "% of humanity's daily words";
  document.getElementById('kpiBar').setAttribute('aria-label', bestSrc.label + ' volume is about ' + pct.toFixed(0) + ' percent of human daily word output');

  const rows = [];
  DATA.volume.forEach(s => s.points.forEach(p => rows.push({...p, src:s.label})));
  rows.sort((a,b)=>a.x-b.x);
  document.getElementById('rows').innerHTML = rows.map(r =>
    `<tr><td class="num">${esc(r.when)}</td><td>${esc(r.src)}</td><td><a href="${esc(r.source)}" target="_blank" rel="noopener">${esc(r.disp)}</a></td><td class="num">${fmt(r.v)}</td></tr>`).join('') +
    `<tr><td class="num">Feb 2024</td><td>All humans (Altman estimate)</td><td>100T words/day</td><td class="num">${fmt(H)}</td></tr>`;
}

const markers = {
  id:'markers',
  beforeDatasetsDraw(chart, args, opts){
    const {ctx, chartArea:a, scales:{x}} = chart;
    ctx.save();
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillStyle = css('--muted'); ctx.strokeStyle = css('--rule');
    ctx.setLineDash([3,3]);
    (opts.list||[]).forEach(e => {
      const px = x.getPixelForValue(e.x);
      if(px<a.left||px>a.right) return;
      ctx.beginPath(); ctx.moveTo(px,a.top); ctx.lineTo(px,a.bottom); ctx.stroke();
      ctx.save(); ctx.translate(px+4, a.top+6); ctx.rotate(Math.PI/2);
      ctx.textBaseline='bottom'; ctx.fillText(e.label,0,0); ctx.restore();
    });
    ctx.restore();
  }
};

function build(){
  if(!DATA) return;
  const muted = css('--muted'), rule = css('--rule'), H = DATA.humanWordsPerDay;
  Chart.defaults.color = muted;
  const events = DATA.events.map(e => ({x:toX(e.date), label:e.label}));
  const allX = DATA.volume.flatMap(s => s.points.map(p=>p.x));
  const xMax = Math.ceil((Math.max(...allX)+0.15)*4)/4;
  const yTop = Math.max(H, ...DATA.volume.flatMap(s=>s.points.map(p=>p.v)));

  const ds = DATA.volume.map(s => ({
    key:s.key, label:s.label, data:s.points.map(p=>({x:p.x,y:p.v,disp:p.disp,when:p.when})),
    borderColor:css(s.color)||css('--machine'), backgroundColor:css(s.color)||css('--machine'), borderWidth:2.5,
    pointRadius:4, pointHoverRadius:6, tension:0.25
  }));
  ds.push({key:'human', label:'All humans (~'+fmt(H)+'/day)', data:[{x:2022.5,y:H},{x:xMax,y:H}],
    borderColor:css('--human'), borderDash:[6,5], borderWidth:2, pointRadius:0, pointHoverRadius:0});

  const prevHidden = volume ? volume.data.datasets.map((d,i)=>!volume.isDatasetVisible(i)) : [];
  const logOn = document.getElementById('btnLog').getAttribute('aria-pressed')==='true';
  if(volume) volume.destroy();
  volume = new Chart(document.getElementById('volume'), {
    type:'line', data:{datasets:ds},
    options:{
      maintainAspectRatio:false, animation:{duration:500},
      interaction:{mode:'nearest', intersect:false},
      plugins:{ legend:{display:false}, markers:{list:events},
        tooltip:{ filter:i=>i.dataset.key!=='human', callbacks:{
          title:i=>i[0].raw.when+' · '+i[0].dataset.label,
          label:i=>[i.raw.disp, '≈ '+fmt(i.raw.y)+' words/day', '≈ '+(i.raw.y/H*100).toFixed(i.raw.y/H<0.01?3:1)+'% of human output']}}},
      scales:{
        x:{type:'linear', min:2022.5, max:xMax, grid:{color:rule}, ticks:{stepSize:0.5, callback:yearTick, color:muted}},
        y:{type:logOn?'logarithmic':'linear', min:logOn?1e10:0, max:logOn?Math.pow(10,Math.ceil(Math.log10(yTop*1.5))):yTop*1.1, grid:{color:rule},
           title:{display:true,text:'words per day',color:muted},
           ticks:{color:muted, callback:v=>{ if(!logOn) return fmt(v); const l=Math.log10(v); return Math.abs(l-Math.round(l))<1e-6?fmt(v):''; }}}
      }
    },
    plugins:[markers]
  });
  prevHidden.forEach((h,i)=>{ if(h) volume.hide(i); });

  const lg = document.getElementById('legend1');
  lg.innerHTML = volume.data.datasets.map((d,i)=>`<label for="lg${i}"><input type="checkbox" id="lg${i}" ${volume.isDatasetVisible(i)?'checked':''}> <span class="sw ${d.key==='human'?'dash':''}" style="background:${d.borderColor}"></span>${esc(d.label)}</label>`).join('');
  lg.querySelectorAll('input').forEach((el,i)=>el.addEventListener('change',()=>{ el.checked?volume.show(i):volume.hide(i); }));

  const ai = DATA.webShare.points.map(p=>({x:toX(p.date), y:p.ai, when:niceDate(p.date)}));
  if(share) share.destroy();
  share = new Chart(document.getElementById('share'), {
    type:'line',
    data:{datasets:[
      {label:'Mostly AI-written', data:ai, borderColor:css('--machine'), backgroundColor:css('--machine-soft'), fill:'origin', borderWidth:2.5, pointRadius:4, tension:0.3},
      {label:'Human-written', data:ai.map(p=>({x:p.x,y:100})), borderColor:'transparent', backgroundColor:css('--human-soft'), fill:'-1', pointRadius:0, pointHoverRadius:0}
    ]},
    options:{ maintainAspectRatio:false, animation:{duration:500},
      interaction:{mode:'nearest',intersect:false},
      plugins:{ legend:{labels:{color:muted, boxWidth:14}}, markers:{list:events.slice(0,2)},
        tooltip:{filter:i=>i.datasetIndex===0, callbacks:{
          title:i=>i[0].raw.when,
          label:i=>[`AI: ~${i.raw.y}%`,`Human: ~${(100-i.raw.y).toFixed(0)}%`]}}},
      scales:{
        x:{type:'linear',min:2022.5,max:Math.max(...ai.map(p=>p.x))+0.25,grid:{color:rule},ticks:{stepSize:0.5,callback:yearTick,color:muted}},
        y:{min:0,max:100,grid:{color:rule},ticks:{stepSize:25,callback:v=>v+'%',color:muted},title:{display:true,text:'share of new articles',color:muted}}
      }
    },
    plugins:[markers]
  });
}

function setScale(log){
  document.getElementById('btnLog').setAttribute('aria-pressed', String(log));
  document.getElementById('btnLin').setAttribute('aria-pressed', String(!log));
  build();
}
document.getElementById('btnLog').addEventListener('click',()=>setScale(true));
document.getElementById('btnLin').addEventListener('click',()=>setScale(false));

if(matchMedia('(prefers-reduced-motion: reduce)').matches) Chart.defaults.animation=false;
Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',build);
new MutationObserver(build).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
Promise.all([fetch('data.json',{cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }), fontsReady])
  .then(([raw]) => { DATA = prepare(raw); renderStatic(); build(); })
  .catch(err => { document.getElementById('checked').textContent = 'Could not load data.json (' + err.message + '). Reload the page to try again.'; });
})();
