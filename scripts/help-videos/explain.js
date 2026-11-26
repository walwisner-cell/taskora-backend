// v181: animated explainer videos (the style Walter chose: drawn scenes, a
// warm narrator, subtitles). Each video is a list of scenes; each scene is
// a list of beats, and each beat is one or two sentences that reveal the
// next thing on screen, so the picture always matches the words.
//
//   node scripts/help-videos/explain.js            make every explainer
//   node scripts/help-videos/explain.js rides      only some
//   node scripts/help-videos/explain.js --check    draw one frame of each scene (fast), make nothing
//   add --tall (phones only) or --wide (laptops only) to make one of the two versions
//
// The scenes are drawn with HTML and CSS in a hidden browser, one frame at a
// time (30 frames a second), then encoded with ffmpeg. Nothing is recorded
// from the real app here: the step-by-step videos (film.js) do that.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const narrate = require(path.join(ROOT, 'scripts/help-videos/narrate.js'));
const ICONS = require('./explain-icons.js');
const W = 1280, H = 720, FPS = 30, FADE = 0.35, PAD = 0.5;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (name, size = 48, color = 'currentColor') => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.dot}</svg>`;
// Bold and gold for **words** in a line.
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="g">$1</b>');

// ── the drawings ─────────────────────────────────────────────────────
// Every element that appears with a beat has data-b="<beat number>".
const B = (i) => `data-b="${i}"`;
function phoneRow(r, i) {
  const k = r.k || 'text', at = r.b != null ? B(r.b) : '';
  const tap = r.tap != null ? `data-tap="${r.tap}"` : '';
  if (k === 'head') return `<div class="ph-head" ${at}>${r.back ? '‹ ' : ''}${esc(r.t)}</div>`;
  if (k === 'field') return `<div class="ph-field" ${at} ${tap}><div class="ph-label">${esc(r.label)}</div><div class="ph-input">${r.type != null ? `<span class="typing" data-type="${r.type}" data-text="${esc(r.value)}"></span>` : esc(r.value || '')}${r.ph ? `<span class="ph-ph">${esc(r.ph)}</span>` : ''}</div></div>`;
  if (k === 'button') return `<div class="ph-btn ${r.ghost ? 'ghost' : ''}" ${at} ${tap}>${esc(r.t)}</div>`;
  if (k === 'card') return `<div class="ph-card ${r.on ? 'on' : ''}" ${at} ${tap}>${r.icon ? `<span class="ph-ic">${icon(r.icon, 30)}</span>` : ''}<div class="ph-ct"><div class="ph-t">${esc(r.t)}</div>${r.sub ? `<div class="ph-s">${esc(r.sub)}</div>` : ''}</div>${r.right ? `<div class="ph-r">${esc(r.right)}</div>` : ''}</div>`;
  if (k === 'chips') return `<div class="ph-chips" ${at}>${r.items.map((c, j) => `<span class="chip ${j === r.on ? 'on' : ''}" ${r.tap != null && j === r.on ? `data-tap="${r.tap}"` : ''}>${esc(c)}</span>`).join('')}</div>`;
  if (k === 'photos') return `<div class="ph-photos" ${at}>${Array.from({ length: r.n || 3 }, (_, j) => `<span class="ph-photo" ${r.each ? B(r.each[j]) : ''}>${icon(j === 0 ? 'home' : j === 1 ? 'sofa' : 'bed', 26, '#5d7290')}</span>`).join('')}</div>`;
  if (k === 'price') return `<div class="ph-price" ${at}>${r.lines.map(l => `<div class="pl"><span>${esc(l[0])}</span><span>${esc(l[1])}</span></div>`).join('')}<div class="pl tot"><span>${esc(r.total[0])}</span><span>${esc(r.total[1])}</span></div></div>`;
  if (k === 'map') return `<div class="ph-map" ${at}><div class="road h"></div><div class="road v"></div><span class="pin a" ${r.pa != null ? B(r.pa) : ''}>${icon('pin', 34, '#1D5FA8')}</span>${r.pb != null ? `<span class="pin b" ${B(r.pb)}>${icon('pin', 34, '#B3423A')}</span><svg class="route" viewBox="0 0 300 140" ${B(r.pb)}><path d="M60 40 L60 100 L240 100" fill="none" stroke="#1D5FA8" stroke-width="6" stroke-dasharray="14 10"/></svg>` : ''}</div>`;
  if (k === 'cal') return `<div class="ph-cal" ${at}>${Array.from({ length: 28 }, (_, j) => `<span class="${(r.taken || []).includes(j) ? 'x' : ''} ${j >= r.from && j <= r.to ? 'sel' : ''}" ${j >= r.from && j <= r.to && r.selB != null ? B(r.selB) : ''}>${j + 1}</span>`).join('')}</div>`;
  if (k === 'note') return `<div class="ph-note ${r.tone || ''}" ${at}>${r.icon ? icon(r.icon, 22) : ''}<span>${esc(r.t)}</span></div>`;
  if (k === 'pin4') return `<div class="ph-pin" ${at}>${String(r.t).split('').map((d, j) => `<span ${r.each ? B(r.each) : ''}>${esc(d)}</span>`).join('')}</div>`;
  if (k === 'stars') return `<div class="ph-stars" ${at}>${[1, 2, 3, 4, 5].map(j => `<span ${r.fill != null ? `data-star="${r.fill}" data-n="${j}"` : ''}>★</span>`).join('')}</div>`;
  if (k === 'bar') return `<div class="ph-bar" ${at}>${(r.items || ['Home', 'Bookings', 'Messages', 'Payments', 'More']).map((c, j) => `<span class="${j === r.on ? 'on' : ''}" ${r.tap != null && j === r.on ? `data-tap="${r.tap}"` : ''}>${esc(c)}</span>`).join('')}</div>`;
  return `<div class="ph-text" ${at}>${rich(r.t)}</div>`;
}
const DRAW = {
  title: (s) => `<div class="c-title"><div class="big-ic" ${B(0)}>${icon(s.icon || 'star', 120, '#F2C230')}</div><h1 ${B(0)}>${rich(s.title)}</h1>${s.sub ? `<p ${B(0)}>${rich(s.sub)}</p>` : ''}${(s.need || []).length ? `<div class="need" ${B(s.needAt || 1)}><div class="need-h">${esc(s.needTitle || 'You need')}</div>${s.need.map(n => `<span>${icon(n.icon, 28, '#F2C230')}${esc(n.t)}</span>`).join('')}</div>` : ''}</div>`,
  phone: (s) => `<div class="c-split"><div class="cap">${s.n ? `<div class="num" ${B(0)}>${esc(s.n)}</div>` : ''}<h2 ${B(0)}>${rich(s.h)}</h2>${(s.points || []).map(p => `<p class="pt" ${B(p.b)}>${icon(p.icon || 'check', 30, '#F2C230')}<span>${rich(p.t)}</span></p>`).join('')}</div>
    <div class="phone"><div class="notch"></div><div class="screen">${(s.rows || []).map(phoneRow).join('')}</div><div class="tapdot"></div></div></div>`,
  list: (s) => `<div class="c-list"><h2 ${B(0)}>${rich(s.h)}</h2><div class="items ${s.cols ? 'cols' : ''}">${s.items.map((it, i) => `<div class="item ${it.tone || ''}" ${B(it.b != null ? it.b : i + (s.from || 1))}><span class="ic">${icon(it.icon || 'check', 40)}</span><div><div class="it">${rich(it.t)}</div>${it.sub ? `<div class="is">${rich(it.sub)}</div>` : ''}</div></div>`).join('')}</div></div>`,
  flow: (s) => `<div class="c-flow"><h2 ${B(0)}>${rich(s.h)}</h2><div class="nodes">${s.nodes.map((n, i) => `${i ? `<div class="arrow" ${B(n.b != null ? n.b : i)}><span>${esc(s.labels ? s.labels[i - 1] : '')}</span>${icon('arrow', 56, '#F2C230')}</div>` : ''}<div class="node ${n.tone || ''}" ${B(n.b != null ? n.b : i)}><div class="nic">${icon(n.icon, 64)}</div><div class="nw"><div class="nt">${rich(n.t)}</div>${n.sub ? `<div class="ns">${rich(n.sub)}</div>` : ''}</div></div>`).join('')}</div>${s.foot ? `<p class="foot" ${B(s.footAt || s.nodes.length)}>${rich(s.foot)}</p>` : ''}</div>`,
  timeline: (s) => `<div class="c-time"><h2 ${B(0)}>${rich(s.h)}</h2><div class="line"><div class="fill" data-fill="${s.points.length}"></div>${s.points.map((p, i) => `<div class="tp" style="left:${(i / (s.points.length - 1)) * 100}%" data-tb="${p.b != null ? p.b : i + 1}"><div class="tpi" ${B(p.b != null ? p.b : i + 1)}><div class="dot">${icon(p.icon || 'dot', 34)}</div><div class="tw"><div class="tl">${rich(p.t)}</div>${p.sub ? `<div class="ts">${rich(p.sub)}</div>` : ''}</div></div></div>`).join('')}</div></div>`,
  table: (s) => `<div class="c-table"><h2 ${B(0)}>${rich(s.h)}</h2><table>${s.head ? `<tr class="th" ${B(0)}>${s.head.map(c => `<th>${esc(c)}</th>`).join('')}</tr>` : ''}${s.rows.map((r, i) => `<tr ${B(r.b != null ? r.b : i + 1)}>${r.c.map((c, j) => `<td class="${j === 0 ? 'k' : ''}">${rich(c)}</td>`).join('')}</tr>`).join('')}</table></div>`,
  warn: (s) => `<div class="c-warn"><div class="shield" ${B(0)}>${icon(s.icon || 'shield', 130, '#0F2640')}</div><div><h2 ${B(0)}>${rich(s.h)}</h2>${s.lines.map((l, i) => `<p ${B(l.b != null ? l.b : i + 1)}>${icon(l.icon || 'x', 30, l.ok ? '#2E8C6F' : '#B3423A')}<span>${rich(l.t)}</span></p>`).join('')}</div></div>`,
  end: (s) => `<div class="c-end"><img class="logo-big" src="LOGO" ${B(0)}><h1 ${B(0)}>${rich(s.title || 'Stuck? Tap **Help videos**')}</h1><p ${B(0)}>${rich(s.sub || 'Or ask us in the support chat. trothenpro.com')}</p></div>`,
};

const CSS = `*{margin:0;box-sizing:border-box}body{width:${W}px;height:${H}px;overflow:hidden;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#fff;background:radial-gradient(circle at 22% 20%,#1D4470,#0F2640 55%,#081627)}
.g{color:#F2C230;font-weight:inherit}.sc{position:absolute;inset:0;opacity:0}
#logo{position:absolute;left:34px;top:26px;width:64px;border-radius:14px;z-index:5}#chip{position:absolute;right:34px;top:34px;z-index:5;border:2px solid #F2C230;color:#F2C230;border-radius:30px;padding:6px 18px;font-size:20px;font-weight:700}
#sub{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);max-width:1080px;background:rgba(5,15,28,.86);border-radius:14px;padding:10px 22px;font-size:25px;line-height:1.35;text-align:center;z-index:6;font-weight:500}
h1{font-size:76px;font-weight:800;line-height:1.05}h2{font-size:48px;font-weight:800;line-height:1.1}
.c-title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:0 90px 80px}.c-title p{font-size:32px;color:#C9D6E6;max-width:980px;line-height:1.35}
.need{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:8px}.need-h{width:100%;font-size:22px;color:#9FB3CA;font-weight:700;letter-spacing:2px;text-transform:uppercase}.need span{display:flex;gap:10px;align-items:center;border:2px solid #2A4C72;border-radius:16px;padding:10px 18px;font-size:26px;font-weight:600;background:rgba(255,255,255,.04)}
.c-split{position:absolute;inset:0;display:flex;align-items:center;gap:60px;padding:86px 90px 96px}.cap{flex:1}.num{width:76px;height:76px;border-radius:50%;background:#F2C230;color:#0F2640;font-size:44px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:22px}
.cap .pt{display:flex;gap:14px;align-items:flex-start;font-size:28px;line-height:1.35;color:#DCE6F2;margin-top:18px}.cap .pt svg{flex:none;margin-top:2px}
.phone{position:relative;flex:none;width:320px;height:540px;border-radius:44px;background:#05101d;box-shadow:0 0 0 3px #2A4C72,0 30px 70px rgba(0,0,0,.5);padding:14px}.notch{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:110px;height:22px;background:#05101d;border-radius:0 0 14px 14px;z-index:2}
.screen{width:100%;height:100%;border-radius:32px;background:#F4F6F9;color:#0F2640;overflow:hidden;padding:34px 16px 12px;display:flex;flex-direction:column;gap:10px;position:relative}
.ph-head{font-size:22px;font-weight:800}.ph-text{font-size:15px;color:#41526A;line-height:1.35}.ph-label{font-size:13px;font-weight:700;color:#41526A;margin-bottom:4px}.ph-input{background:#fff;border:2px solid #D5DCE5;border-radius:10px;min-height:40px;padding:9px 11px;font-size:15px;position:relative}.ph-ph{color:#9aa4b2}
.ph-btn{background:#1D5FA8;color:#fff;border-radius:12px;text-align:center;padding:12px;font-weight:700;font-size:16px}.ph-btn.ghost{background:#fff;color:#1D5FA8;border:2px solid #1D5FA8}
.ph-card{display:flex;gap:10px;align-items:center;background:#fff;border:2px solid #E1E6EE;border-radius:12px;padding:9px 11px}.ph-card.on{border-color:#F2C230;background:#FFF8E1}.ph-ic{color:#1D5FA8;flex:none}.ph-ct{flex:1;min-width:0}.ph-t{font-weight:700;font-size:15px}.ph-s{font-size:12.5px;color:#56616D}.ph-r{font-weight:800;font-size:15px}
.ph-chips{display:flex;gap:6px;flex-wrap:wrap}.chip{border:2px solid #C9D3DF;border-radius:20px;padding:5px 11px;font-size:13px;font-weight:600;background:#fff}.chip.on{background:#1D5FA8;color:#fff;border-color:#1D5FA8}
.ph-photos{display:flex;gap:8px}.ph-photo{width:86px;height:70px;border-radius:10px;background:#DCE6F2;display:flex;align-items:center;justify-content:center}
.ph-price{background:#fff;border-radius:12px;padding:10px 12px;font-size:14px}.pl{display:flex;justify-content:space-between;padding:3px 0}.pl.tot{border-top:2px solid #E1E6EE;margin-top:4px;padding-top:6px;font-weight:800;font-size:16px}
.ph-map{position:relative;height:150px;border-radius:12px;background:#E4EAF0;overflow:hidden}.road{position:absolute;background:#fff}.road.h{left:0;right:0;top:95px;height:16px}.road.v{top:0;bottom:0;left:52px;width:16px}.pin{position:absolute}.pin.a{left:43px;top:14px}.pin.b{left:224px;top:66px}.route{position:absolute;inset:0;width:100%;height:100%}
.ph-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.ph-cal span{background:#fff;border-radius:6px;text-align:center;font-size:12px;padding:5px 0;font-weight:600}.ph-cal span.x{color:#a8b0bb;text-decoration:line-through;background:#EDF0F3}.ph-cal span.sel{background:#0f766e;color:#fff}
.ph-note{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.35;background:#E8F4F0;border-radius:10px;padding:8px 10px;color:#1F5E4C}.ph-note.warn{background:#FFF4E0;color:#7A4B00}
.ph-pin{display:flex;gap:8px;justify-content:center}.ph-pin span{width:48px;height:58px;border-radius:10px;background:#0F2640;color:#F2C230;font-size:32px;font-weight:800;display:flex;align-items:center;justify-content:center}
.ph-stars{display:flex;gap:6px;justify-content:center;font-size:40px;color:#C4CCD6}.ph-bar{margin-top:auto;display:flex;justify-content:space-between;border-top:1px solid #DDE3EA;padding-top:8px;font-size:11.5px;font-weight:600;color:#56616D}.ph-bar span.on{color:#1D5FA8}
.tapdot{position:absolute;width:56px;height:56px;border-radius:50%;border:5px solid rgba(242,194,48,.95);background:rgba(242,194,48,.25);pointer-events:none;opacity:0;z-index:4}
.typing::after{content:'|';animation:none;color:#1D5FA8;margin-left:1px}
.c-list{position:absolute;inset:0;padding:110px 110px 110px}.c-list .items{display:flex;flex-direction:column;gap:18px;margin-top:34px}.c-list .items.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px 40px}
.item{display:flex;gap:18px;align-items:flex-start}.item .ic{flex:none;width:66px;height:66px;border-radius:18px;background:rgba(242,194,48,.14);color:#F2C230;display:flex;align-items:center;justify-content:center}.item.bad .ic{background:rgba(179,66,58,.18);color:#FF9C92}.item.ok .ic{background:rgba(46,140,111,.2);color:#7FE0BC}
.it{font-size:31px;font-weight:700;line-height:1.25}.is{font-size:23px;color:#B9C8DA;margin-top:4px;line-height:1.3}
.c-flow{position:absolute;inset:0;padding:110px 70px 110px;text-align:center}.nodes{display:flex;align-items:flex-start;justify-content:center;gap:10px;margin-top:50px}.node{width:260px;background:rgba(255,255,255,.06);border:2px solid #2A4C72;border-radius:22px;padding:24px 14px}.node.gold{border-color:#F2C230;background:rgba(242,194,48,.1)}.nic{color:#F2C230;margin-bottom:10px}.nt{font-size:27px;font-weight:800;line-height:1.2}.ns{font-size:21px;color:#B9C8DA;margin-top:8px;line-height:1.3}
.arrow{display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:40px;width:120px;font-size:18px;color:#F2C230;font-weight:700}.foot{font-size:27px;color:#DCE6F2;margin-top:36px;line-height:1.35}
.c-time{position:absolute;inset:0;padding:110px 60px}.line{position:relative;height:8px;background:#2A4C72;border-radius:4px;margin:150px 110px 0}.fill{position:absolute;left:0;top:0;height:8px;background:#F2C230;border-radius:4px;width:0}
.tp{position:absolute;top:-34px;transform:translateX(-50%);width:230px;text-align:center}.dot{width:76px;height:76px;border-radius:50%;background:#0F2640;border:4px solid #F2C230;color:#F2C230;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}.tl{font-size:26px;font-weight:800;line-height:1.2}.ts{font-size:20px;color:#B9C8DA;margin-top:6px;line-height:1.3}
.c-table{position:absolute;inset:0;padding:105px 100px}.c-table table{width:100%;border-collapse:separate;border-spacing:0 10px;margin-top:26px;font-size:25px}.c-table td,.c-table th{padding:13px 18px;background:rgba(255,255,255,.06);text-align:left;line-height:1.3}.c-table th{background:transparent;color:#9FB3CA;font-size:20px;text-transform:uppercase;letter-spacing:1px}.c-table td.k{font-weight:800;color:#F2C230;width:28%}.c-table td:first-child{border-radius:12px 0 0 12px}.c-table td:last-child{border-radius:0 12px 12px 0}
.c-warn{position:absolute;inset:0;display:flex;align-items:center;gap:50px;padding:60px 110px 110px}.shield{flex:none;width:230px;height:230px;border-radius:50%;background:#F2C230;display:flex;align-items:center;justify-content:center}.c-warn p{display:flex;gap:14px;align-items:flex-start;font-size:29px;line-height:1.35;margin-top:18px;color:#E6EDF6}.c-warn p svg{flex:none;margin-top:3px}
.c-end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center;padding-bottom:70px}.logo-big{width:170px;border-radius:36px}.c-end p{font-size:32px;color:#C9D6E6}`;

// The page: every scene stacked, and a render(t) that sets what shows at time t.
const CSS_TALL = `
body.tall{width:720px;height:1280px}.tall h1{font-size:62px}.tall h2{font-size:44px}
.tall #logo{left:28px;top:30px;width:74px}.tall #chip{right:28px;top:44px;font-size:22px}
.tall #sub{bottom:118px;width:660px;max-width:660px;font-size:30px;padding:12px 20px}
.tall .c-title{padding:0 46px 290px;gap:26px}.tall .c-title p{font-size:33px}.tall .need span{font-size:26px}
.tall .c-split{flex-direction:column;justify-content:flex-start;align-items:stretch;gap:26px;padding:150px 46px 290px}
.tall .num{width:62px;height:62px;font-size:36px;margin-bottom:12px}.tall .cap .pt{font-size:27px;margin-top:10px}
.tall .phone{align-self:center;width:420px;height:560px;border-radius:40px}.tall .screen{zoom:1.3;width:302px;height:409px;border-radius:26px;padding-top:28px}
.tall .c-list{padding:160px 46px 290px}.tall .c-list .items{gap:22px;margin-top:30px}.tall .items.cols{grid-template-columns:1fr}.tall .it{font-size:30px}.tall .is{font-size:24px}
.tall .c-flow{padding:160px 46px 290px}.tall .nodes{flex-direction:column;align-items:center;gap:0;margin-top:36px}
.tall .node{width:600px;display:flex;gap:20px;align-items:center;text-align:left;padding:18px 22px}.tall .nic{margin:0;flex:none}.tall .arrow{padding:6px 0;width:auto;height:64px;flex-direction:row;gap:10px}.tall .arrow svg{transform:rotate(90deg)}.tall .foot{font-size:29px;margin-top:30px;text-align:left}
.tall .c-time{padding:160px 46px 290px}.tall .line{width:8px;height:720px;margin:50px 0 0 84px}.tall .fill{width:8px!important;height:0}
.tall .tp{left:-38px!important;top:0;transform:none;width:560px;text-align:left;position:relative;margin-bottom:96px}.tall .tpi{display:flex;gap:20px;align-items:center}.tall .dot{margin:0;flex:none}.tall .tl{font-size:30px}.tall .ts{font-size:24px}
.tall .c-table{padding:160px 30px 290px}.tall .c-table table{font-size:23px}.tall .c-table td,.tall .c-table th{padding:12px 12px}
.tall .c-warn{flex-direction:column;align-items:flex-start;gap:26px;padding:160px 46px 290px}.tall .shield{align-self:center;width:170px;height:170px}.tall .shield svg{width:100px;height:100px}.tall .c-warn p{font-size:29px}
.tall .c-end{padding:0 40px 200px}.tall .c-end h1{font-size:58px}`;
function pageHTML(v, logo, tall) {
  const scenes = v.scenes.map((s, i) => `<div class="sc" id="s${i}">${DRAW[s.kind](s).replace(/src="LOGO"/g, `src="${logo}"`)}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${CSS_TALL}</style></head><body class="${tall ? 'tall' : ''}">
<img id="logo" src="${logo}" alt=""><div id="chip">${esc(v.chip || 'Help video')}</div>${scenes}<div id="sub"></div>
<script>
const cl=x=>Math.max(0,Math.min(1,x));const ease=x=>1-Math.pow(1-cl(x),3);const back=x=>{x=cl(x);const c=1.6;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
let TL=null;function setTL(x){TL=x}
function render(t){
  let subtxt='';
  TL.scenes.forEach((sc,i)=>{
    const el=document.getElementById('s'+i);
    const o=Math.min(ease((t-sc.start)/${FADE}),i===TL.scenes.length-1?1:1-ease((t-sc.end+${FADE})/${FADE}));
    el.style.opacity=cl(o); el.style.display=o<=0?'none':'block';
    if(o<=0)return;
    const lt=t-sc.start;
    el.querySelectorAll('[data-b]').forEach(n=>{const b=+n.dataset.b;const at=sc.beats[Math.min(b,sc.beats.length-1)];const k=ease((lt-at)/0.45);n.style.opacity=k;n.style.transform='translateY('+((1-k)*18)+'px)';});
    el.querySelectorAll('[data-type]').forEach(n=>{const b=+n.dataset.type;const at=sc.beats[b]+0.3;const txt=n.dataset.text;const k=cl((lt-at)/Math.max(0.8,txt.length*0.06));n.textContent=txt.slice(0,Math.round(k*txt.length));});
    el.querySelectorAll('[data-star]').forEach(n=>{const at=sc.beats[+n.dataset.star]+0.3+(+n.dataset.n)*0.18;n.style.color=lt>at?'#F2C230':'#C4CCD6';});
    const fill=el.querySelector('[data-fill]');if(fill){const n=+fill.dataset.fill;let k=0,lastAt=0;el.querySelectorAll('.tp').forEach(tp=>{const at=sc.beats[Math.min(+tp.dataset.tb,sc.beats.length-1)];if(lt>=at){k++;lastAt=Math.max(lastAt,at);}});const prev=Math.max(0,k-2),cur=Math.max(0,k-1);const pc=((prev+(cur-prev)*ease((lt-lastAt)/0.8))/(n-1)*100)+'%';if(document.body.classList.contains('tall'))fill.style.height=pc;else fill.style.width=pc;}
    const dot=el.querySelector('.tapdot');
    if(dot){let on=null;el.querySelectorAll('[data-tap]').forEach(n=>{const b=+n.dataset.tap;const at=sc.beats[b]+0.5;if(lt>=at&&lt<at+1.6)on={n,k:(lt-at)/1.6};});
      if(on){const ph=el.querySelector('.phone').getBoundingClientRect();const r=on.n.getBoundingClientRect();dot.style.left=(r.left-ph.left+r.width/2-28)+'px';dot.style.top=(r.top-ph.top+r.height/2-28)+'px';dot.style.opacity=1-on.k*0.6;dot.style.transform='scale('+(0.7+0.5*Math.sin(on.k*Math.PI))+')';}else dot.style.opacity=0;}
    sc.subs.forEach(s=>{if(lt>=s.at&&lt<s.to)subtxt=s.t;});
  });
  const sub=document.getElementById('sub');sub.textContent=subtxt;sub.style.opacity=subtxt?1:0;
  // a short fingerprint of everything drawn, so an unchanged frame is not drawn twice
  let h=5381;const st=document.body.innerHTML.replace(/src="data:[^"]*"/g,'');for(let i=0;i<st.length;i++)h=((h*33)^st.charCodeAt(i))|0;return h;
}
</script></body></html>`;
}

// The Trothen icon without its dark border, for the corner and the last scene.
let LOGO = null;
function logoData(tmp) {
  if (LOGO) return LOGO;
  const out = path.join(tmp, 'logo.png'); fs.mkdirSync(tmp, { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(ROOT, 'public/icon-512.png'), '-vf', 'crop=244:244:134:132', out]);
  LOGO = 'data:image/png;base64,' + fs.readFileSync(out).toString('base64');
  return LOGO;
}
// Speaks every beat and works out when each scene and beat starts.
async function timeline(v) {
  let t = 0; const scenes = [], lines = [];
  for (const s of v.scenes) {
    const start = t, beats = [], subs = [];
    let lt = 0.3;
    for (const b of s.beats) {
      const said = await narrate.say(b);
      beats.push(lt);
      lines.push({ file: said.file, at: start + lt, text: b });
      // the subtitle shows one sentence at a time, timed by its share of the words
      const parts = b.match(/(?:\d\.\d|[^.!?])+[.!?]*/g).map(x => x.trim()).filter(Boolean); // v182: never split inside a number like 4.7
      const words = parts.map(p => p.split(/\s+/).length), total = words.reduce((a, c) => a + c, 0);
      let at = lt + 0.2; const speak = Math.max(0.5, said.seconds - 0.2 - 0.45 * parts.length);
      parts.forEach((p, i) => { const d = speak * words[i] / total + 0.45; subs.push({ t: p, at, to: at + d }); at += d; });
      lt += said.seconds + 0.15;
    }
    const dur = lt + PAD + (s.hold || 0);
    scenes.push({ start, end: start + dur, beats, subs });
    t += dur;
  }
  return { scenes, lines, seconds: t };
}

async function makeOne(v, outDir, br, opts) {
  const logo = logoData(opts.tmp);
  const TL = await timeline(v);
  const tall = opts.format === 'tall';
  const [w, h] = tall ? [H, W] : [W, H];
  const html = pageHTML(v, logo, tall);
  const work = path.join(opts.tmp, v.key + (tall ? '-tall' : '')); fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
  fs.writeFileSync(path.join(work, 'page.html'), html);
  const p = await br.newPage({ viewport: { width: w, height: h } });
  await p.goto('file://' + path.join(work, 'page.html'));
  // the icon in the corner is cropped to the logo itself
  await p.evaluate((TL) => setTL(TL), TL); await p.evaluate(() => document.fonts.ready);
  if (opts.check) {
    let i = 0; for (const sc of TL.scenes) { await p.evaluate(t => render(t), sc.end - 0.6); await p.screenshot({ path: path.join(work, `check-${i++}.jpg`), type: 'jpeg', quality: 80 }); }
    await p.close(); return { key: v.key, seconds: TL.seconds, frames: path.join(work, 'check-0.jpg') };
  }
  const N = Math.ceil(TL.seconds * FPS);
  const frames = path.join(work, 'f'); fs.mkdirSync(frames);
  let last = null, lastFile = null;
  for (let i = 0; i < N; i++) {
    const sig = await p.evaluate(t => render(t), i / FPS);
    const f = path.join(frames, String(i).padStart(5, '0') + '.jpg');
    if (sig === last) fs.linkSync(lastFile, f); // nothing moved: the same picture again
    else { await p.screenshot({ path: f, type: 'jpeg', quality: 90 }); last = sig; lastFile = f; }
  }
  await p.close();
  const silent = path.join(work, 'silent.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent]);
  const tmpOut = path.join(work, 'out.mp4');
  narrate.addSound(silent, TL.lines, tmpOut);
  const file = path.join(outDir, v.group === 'admin' ? `help-admin-x-${v.key}.mp4` : `explain-${v.key}${tall ? '' : '-computer'}.mp4`);
  fs.renameSync(tmpOut, file);
  // the cover picture: the moment the title is fully drawn
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.min(2.5, TL.seconds / 2)), '-i', file, '-frames:v', '1', '-vf', tall ? 'scale=-2:380,pad=640:400:(ow-iw)/2:(oh-ih)/2:color=0x0F2640' : 'scale=640:360,pad=640:400:0:20:color=0x0F2640', '-q:v', '4', file.replace(/\.mp4$/, '.jpg')]);
  fs.rmSync(frames, { recursive: true, force: true });
  return { file: path.basename(file, '.mp4'), seconds: Math.round(TL.seconds), transcript: v.scenes.flatMap(s => s.beats) };
}

module.exports = { makeOne, timeline, pageHTML, DRAW, icon };

// ── node scripts/help-videos/explain.js [names] [--check] [--tall|--wide] ──
// Makes the explainers in explainers/ into public/help/ (explain-<name>.mp4 for
// phones, explain-<name>-computer.mp4 for laptops) and adds them to
// help-videos.json, next to the step-by-step video on the same subject.
if (require.main === module) (async () => {
  const args = process.argv.slice(2), ONLY = args.filter(a => !a.startsWith('--')), CHECK = args.includes('--check');
  const ASKED = args.includes('--tall') ? ['tall'] : args.includes('--wide') ? ['wide'] : ['tall', 'wide'];
  // v182: the team's explainers (explainers/admin/) are never on the public site: they go
  // to help-admin/ with the team's screen videos, and are made wide only (Admin is used on a computer).
  const PLACE = {
    public: { out: path.join(ROOT, 'public', 'help'), list: 'help-videos.json' },
    admin: { out: path.join(ROOT, 'help-admin'), list: 'admin-help-videos.json' },
  };
  const dir = path.join(__dirname, 'explainers');
  const load = (d, group) => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.js')).map(f => ({ group, ...require(path.join(d, f)) })) : [];
  const all = [...load(dir, 'public'), ...load(path.join(dir, 'admin'), 'admin')];
  const flows = require('./flows.js');
  const todo = all.filter(v => !ONLY.length || ONLY.includes(v.key) || ONLY.includes(v.group));
  if (!todo.length) { console.error('No explainer called ' + ONLY.join(', ')); process.exit(1); }
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'trothen-explain-'));
  const { chromium } = require('playwright');
  const br = await chromium.launch();
  const lists = {};
  const listOf = (g) => { if (!lists[g]) { try { lists[g] = JSON.parse(fs.readFileSync(path.join(PLACE[g].out, PLACE[g].list), 'utf8')); } catch (e) { lists[g] = []; } } return lists[g]; };
  try {
    for (const v of todo) {
      const g = v.group, OUT = PLACE[g].out, list = listOf(g);
      const FORMATS = g === 'admin' ? ['wide'] : ASKED;
      const f = flows.find(x => x.key === (v.flow || v.key) && x.group === g) || {};
      v.chip = g === 'admin' ? 'Help video for the team · ' + (v.area || 'Admin') : 'Help video · ' + (v.topic || f.topic || 'Trothen');
      if (CHECK) { for (const format of FORMATS) { const r = await makeOne(v, OUT, br, { tmp, check: true, format }); console.log(`checked ${v.key} (${format}): ${Math.round(r.seconds)} s, frames in ${path.dirname(r.frames)}`); } continue; }
      const made = {};
      for (const format of FORMATS) { made[format] = await makeOne(v, OUT, br, { tmp, format }); console.log(`made ${made[format].file}.mp4: ${made[format].seconds} s`); }
      const key = v.flow || v.key; // an explainer can sit next to a screen video with another name
      let m = list.find(x => x.key === key);
      if (g === 'admin') {
        if (!m) { m = { key, section: v.section, title: v.title, tagline: v.tagline || '' }; list.push(m); }
        if (v.sections) m.sections = v.sections; // a video that covers more than one part of Admin
        m.explainer = { file: made.wide.file, seconds: made.wide.seconds, transcript: made.wide.transcript };
      } else {
        if (!m) { m = { key, title: v.title, tagline: v.tagline || '', topic: v.topic || f.topic, audience: v.audience || f.audience || 'all' }; list.push(m); }
        const was = m.explainer || {};
        m.explainer = { ...(made.tall || { file: was.file, seconds: was.seconds, transcript: was.transcript }), computer: made.wide ? { file: made.wide.file, seconds: made.wide.seconds } : was.computer };
      }
      fs.writeFileSync(path.join(OUT, PLACE[g].list), JSON.stringify(list, null, 1) + '\n');
    }
  } finally { await br.close(); narrate.stop(); if (!CHECK) fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
