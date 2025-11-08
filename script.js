/* Basic Canva-like editor using plain Canvas 2D + hitboxes + transforms.
   Features: add shapes/text/images, drag/resize/rotate, layers, undo/redo, pages, presets, export PNG.
*/

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusbar = document.getElementById('statusbar');
const zoomRange = document.getElementById('zoomRange');
const zoomLabel = document.getElementById('zoomLabel');

const state = {
  pages: [newPage()],
  pageIndex: 0,
  selection: null, // {id}
  zoom: 1,
  history: [],
  future: [],
};

function newPage() {
  return {
    width: 1080,
    height: 1350,
    objects: [], // {id,type,x,y,w,h,rot,fill,stroke,strokeW,text,font,size,align,img}
    nextId: 1,
  };
}
function currentPage(){ return state.pages[state.pageIndex]; }

function addHistory() {
  state.history.push(JSON.stringify(state.pages));
  state.future = [];
}

function setCanvasSize(w, h) {
  const z = state.zoom;
  canvas.width = Math.round(w * z);
  canvas.height = Math.round(h * z);
  canvas.style.width = `${Math.round(w * z)}px`;
  canvas.style.height = `${Math.round(h * z)}px`;
}

function draw() {
  const page = currentPage();
  setCanvasSize(page.width, page.height);
  ctx.save();
  ctx.scale(state.zoom, state.zoom);
  ctx.clearRect(0,0,page.width,page.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,page.width,page.height);

  // draw objects
  page.objects.forEach(obj => {
    ctx.save();
    ctx.translate(obj.x + obj.w/2, obj.y + obj.h/2);
    ctx.rotate(obj.rot * Math.PI/180);
    ctx.translate(-obj.w/2, -obj.h/2);

    if (obj.type === 'rect') {
      fillStrokeRect(obj);
    } else if (obj.type === 'circle') {
      fillStrokeEllipse(obj);
    } else if (obj.type === 'triangle') {
      fillStrokeTriangle(obj);
    } else if (obj.type === 'line') {
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = obj.strokeW;
      ctx.beginPath();
      ctx.moveTo(0, obj.h/2);
      ctx.lineTo(obj.w, obj.h/2);
      ctx.stroke();
    } else if (obj.type === 'text') {
      ctx.fillStyle = obj.fill;
      ctx.font = `${obj.size}px ${obj.font}`;
      ctx.textAlign = obj.align;
      const tx = obj.align === 'left' ? 0 :
                 obj.align === 'center' ? obj.w/2 : obj.w;
      wrapText(ctx, obj.text, tx, obj.size, obj.w, obj.size * 1.2);
    } else if (obj.type === 'image' && obj.img) {
      ctx.drawImage(obj.img, 0, 0, obj.w, obj.h);
    }

    // selection box
    if (state.selection && state.selection.id === obj.id) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, obj.w, obj.h);
      drawHandles(obj);
    }

    ctx.restore();
  });

  ctx.restore();
  status(`Objects: ${page.objects.length}${state.selection ? ` • Selected #${state.selection.id}`:''}`);
}

function status(msg){ statusbar.textContent = msg; }

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' ');
  let line = '';
  let yy = y;
  for(let n=0;n<words.length;n++){
    const testLine = line + words[n] + ' ';
    const metrics = context.measureText(testLine);
    if (metrics.width > maxWidth && n>0){
      context.fillText(line, x, yy);
      line = words[n] + ' ';
      yy += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, yy);
}

function fillStrokeRect(o){
  roundRect(ctx, 0,0,o.w,o.h, 12);
  ctx.fillStyle = o.fill; ctx.fill();
  if (o.strokeW>0){ ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW; ctx.stroke(); }
}
function fillStrokeEllipse(o){
  ctx.beginPath();
  ctx.ellipse(o.w/2, o.h/2, o.w/2, o.h/2, 0, 0, Math.PI*2);
  ctx.fillStyle = o.fill; ctx.fill();
  if (o.strokeW>0){ ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW; ctx.stroke(); }
}
function fillStrokeTriangle(o){
  ctx.beginPath();
  ctx.moveTo(o.w/2, 0);
  ctx.lineTo(0, o.h);
  ctx.lineTo(o.w, o.h);
  ctx.closePath();
  ctx.fillStyle = o.fill; ctx.fill();
  if (o.strokeW>0){ ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW; ctx.stroke(); }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}

// Object helpers
function createBase(type){
  const page = currentPage();
  const id = page.nextId++;
  return {
    id, type,
    x: 120 + id*6, y: 120 + id*6,
    w: 260, h: 180,
    rot: 0,
    fill: '#22d3ee',
    stroke: '#111827',
    strokeW: 2,
    text: 'Type here',
    font: 'Inter',
    size: 48,
    align: 'left',
    img: null,
  };
}

function addObject(obj){
  addHistory();
  currentPage().objects.push(obj);
  state.selection = { id: obj.id };
  draw();
}
function getObjectById(id){
  return currentPage().objects.find(o => o.id === id);
}
function getObjectAtPoint(px, py){
  const page = currentPage();
  // account for zoom
  const x = px / state.zoom;
  const y = py / state.zoom;
  for (let i=page.objects.length-1; i>=0; i--){
    const o = page.objects[i];
    // reverse transform: translate to center, rotate inverse
    const cx = o.x + o.w/2, cy = o.y + o.h/2;
    const dx = x - cx, dy = y - cy;
    const cos = Math.cos(-o.rot * Math.PI/180), sin = Math.sin(-o.rot * Math.PI/180);
    const rx = cos*dx - sin*dy + o.w/2;
    const ry = sin*dx + cos*dy + o.h/2;
    if (rx>=0 && ry>=0 && rx<=o.w && ry<=o.h) return o;
  }
  return null;
}

function bringForward(){
  const page = currentPage();
  const sel = state.selection && getObjectById(state.selection.id);
  if (!sel) return;
  const i = page.objects.indexOf(sel);
  if (i < page.objects.length - 1) {
    addHistory();
    [page.objects[i], page.objects[i+1]] = [page.objects[i+1], page.objects[i]];
    draw();
  }
}
function sendBack(){
  const page = currentPage();
  const sel = state.selection && getObjectById(state.selection.id);
  if (!sel) return;
  const i = page.objects.indexOf(sel);
  if (i > 0) {
    addHistory();
    [page.objects[i], page.objects[i-1]] = [page.objects[i-1], page.objects[i]];
    draw();
  }
}

// Drag / resize / rotate
let drag = { mode:null, offsetX:0, offsetY:0, start:{x:0,y:0}, startRot:0, startWH:{w:0,h:0}, object:null };

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const o = getObjectAtPoint(x, y);
  if (o) {
    state.selection = { id: o.id };
    drag.object = o;
    // detect modifier for rotate
    if (e.shiftKey) {
      drag.mode = 'rotate';
      drag.start.x = x; drag.start.y = y; drag.startRot = o.rot;
    } else if (e.altKey) {
      drag.mode = 'resize';
      drag.start.x = x; drag.start.y = y; drag.startWH = { w:o.w, h:o.h };
    } else {
      drag.mode = 'move';
      drag.offsetX = x/state.zoom - o.x;
      drag.offsetY = y/state.zoom - o.y;
    }
    addHistory();
  } else {
    state.selection = null;
  }
  draw();
});
window.addEventListener('mousemove', e => {
  if (!drag.mode || !drag.object) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const o = drag.object;

  if (drag.mode === 'move') {
    o.x = x/state.zoom - drag.offsetX;
    o.y = y/state.zoom - drag.offsetY;
  } else if (drag.mode === 'resize') {
    const dx = (x - drag.start.x) / state.zoom;
    const dy = (y - drag.start.y) / state.zoom;
    o.w = Math.max(20, drag.startWH.w + dx);
    o.h = Math.max(20, drag.startWH.h + dy);
  } else if (drag.mode === 'rotate') {
    const cx = (o.x + o.w/2) * state.zoom;
    const cy = (o.y + o.h/2) * state.zoom;
    const ang = Math.atan2(y - cy, x - cx) * 180/Math.PI;
    o.rot = Math.round(ang + 90); // simple rotation
  }
  draw();
});
window.addEventListener('mouseup', () => { drag = { mode:null, object:null }; });

// Keyboard shortcuts
window.addEventListener('keydown', e => {
  const sel = state.selection && getObjectById(state.selection.id);
  if (e.key === 'Delete' && sel) {
    addHistory();
    const page = currentPage();
    page.objects = page.objects.filter(o => o.id !== sel.id);
    state.selection = null;
    draw();
  }
  // nudging
  if (sel && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    addHistory();
    const step = e.shiftKey ? 10 : 2;
    if (e.key==='ArrowUp') sel.y -= step;
    if (e.key==='ArrowDown') sel.y += step;
    if (e.key==='ArrowLeft') sel.x -= step;
    if (e.key==='ArrowRight') sel.x += step;
    draw();
  }
  // undo/redo
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase()==='z') {
    if (e.shiftKey) redo(); else undo();
    e.preventDefault();
  }
});

// UI bindings
document.querySelectorAll('[data-add]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const type = btn.getAttribute('data-add');
    const base = createBase(type);
    if (type==='circle'){ base.w=220; base.h=220; base.fill='#8b5cf6'; }
    if (type==='triangle'){ base.w=220; base.h=180; base.fill='#22d3ee'; }
    if (type==='line'){ base.w=300; base.h=4; base.stroke='#8b5cf6'; base.strokeW=6; base.fill='transparent'; }
    if (type==='rect'){ base.fill='#22d3ee'; }
    if (type==='text'){ base.w=420; base.h=200; base.fill='#111827'; base.size=48; base.text='Type your title'; base.align='left'; }
    addObject(base);
  });
});

document.getElementById('imageInput').addEventListener('change', e=>{
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = ()=>{
    const base = createBase('image');
    base.w = Math.min(img.naturalWidth, 600);
    base.h = Math.round(base.w * (img.naturalHeight/img.naturalWidth));
    base.img = img;
    addObject(base);
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

// Properties panel
const propX = document.getElementById('propX');
const propY = document.getElementById('propY');
const propW = document.getElementById('propW');
const propH = document.getElementById('propH');
const propRot = document.getElementById('propRot');
const propFill = document.getElementById('propFill');
const propStroke = document.getElementById('propStroke');
const propStrokeW = document.getElementById('propStrokeW');
const propText = document.getElementById('propText');
const propFont = document.getElementById('propFont');
const propFontSize = document.getElementById('propFontSize');
document.querySelectorAll('[data-text]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const sel = state.selection && getObjectById(state.selection.id);
    if (!sel || sel.type!=='text') return;
    addHistory();
    sel.align = btn.getAttribute('data-text');
    draw(); syncProps();
  });
});
document.querySelector('[data-prop="bringForward"]').addEventListener('click', bringForward);
document.querySelector('[data-prop="sendBack"]').addEventListener('click', sendBack);

[propX,propY,propW,propH,propRot,propFill,propStroke,propStrokeW,propText,propFont,propFontSize].forEach(el=>{
  el.addEventListener('input', ()=>{
    const sel = state.selection && getObjectById(state.selection.id);
    if (!sel) return;
    addHistory();
    if (el===propX) sel.x = parseFloat(propX.value)||0;
    if (el===propY) sel.y = parseFloat(propY.value)||0;
    if (el===propW) sel.w = Math.max(10, parseFloat(propW.value)||10);
    if (el===propH) sel.h = Math.max(10, parseFloat(propH.value)||10);
    if (el===propRot) sel.rot = parseFloat(propRot.value)||0;
    if (el===propFill) sel.fill = propFill.value;
    if (el===propStroke) sel.stroke = propStroke.value;
    if (el===propStrokeW) sel.strokeW = Math.max(0, parseFloat(propStrokeW.value)||0);
    if (el===propText && sel.type==='text') sel.text = propText.value;
    if (el===propFont && sel.type==='text') sel.font = propFont.value;
    if (el===propFontSize && sel.type==='text') sel.size = Math.max(8, parseFloat(propFontSize.value)||8);
    draw(); syncProps();
  });
});

function syncProps(){
  const sel = state.selection && getObjectById(state.selection.id);
  const textOnly = document.querySelectorAll('.text-only');
  if (!sel) {
    [propX,propY,propW,propH,propRot,propFill,propStroke,propStrokeW,propText,propFont,propFontSize].forEach(i=>i.value='');
    textOnly.forEach(el=>el.style.display='none');
    return;
  }
  propX.value = Math.round(sel.x);
  propY.value = Math.round(sel.y);
  propW.value = Math.round(sel.w);
  propH.value = Math.round(sel.h);
  propRot.value = Math.round(sel.rot);
  propFill.value = sel.fill;
  propStroke.value = sel.stroke;
  propStrokeW.value = sel.strokeW;
  if (sel.type==='text'){
    propText.value = sel.text;
    propFont.value = sel.font;
    propFontSize.value = sel.size;
    textOnly.forEach(el=>el.style.display='grid');
  } else {
    textOnly.forEach(el=>el.style.display='none');
  }
}

// Top actions
document.querySelector('[data-action="new"]').addEventListener('click', ()=>{
  addHistory();
  state.pages = [newPage()]; state.pageIndex=0; state.selection=null;
  draw(); rebuildPages();
});
document.querySelector('[data-action="save"]').addEventListener('click', ()=>{
  const data = JSON.stringify({ pages: state.pages });
  localStorage.setItem('kcw.design', data);
  status('Saved to local storage.');
});
document.querySelector('[data-action="load"]').addEventListener('click', ()=>{
  const raw = localStorage.getItem('kcw.design');
  if (!raw){ status('Nothing saved yet.'); return; }
  const data = JSON.parse(raw);
  state.pages = data.pages || [newPage()];
  state.pageIndex = 0; state.selection=null;
  draw(); rebuildPages();
  status('Loaded from local storage.');
});
document.querySelector('[data-action="export"]').addEventListener('click', exportPNG);

function exportPNG(){
  const link = document.createElement('a');
  link.download = `kcw-design-page-${state.pageIndex+1}.png`;
  link.href = canvas.toDataURL('image/png', 1);
  link.click();
  status('Exported PNG.');
}

// Zoom
zoomRange.addEventListener('input', ()=>{
  const pct = parseInt(zoomRange.value,10);
  state.zoom = pct/100;
  zoomLabel.textContent = `${pct}%`;
  draw();
});

// Undo/Redo
function undo(){
  if (state.history.length === 0) return;
  const prev = state.history.pop();
  state.future.push(JSON.stringify(state.pages));
  state.pages = JSON.parse(prev);
  state.pageIndex = Math.min(state.pageIndex, state.pages.length-1);
  state.selection = null;
  draw(); rebuildPages();
}
function redo(){
  if (state.future.length === 0) return;
  const next = state.future.pop();
  state.history.push(JSON.stringify(state.pages));
  state.pages = JSON.parse(next);
  state.pageIndex = Math.min(state.pageIndex, state.pages.length-1);
  state.selection = null;
  draw(); rebuildPages();
}

// Pages
const pagesList = document.getElementById('pagesList');
document.getElementById('addPage').addEventListener('click', ()=>{
  addHistory();
  state.pages.push(newPage());
  state.pageIndex = state.pages.length - 1;
  rebuildPages(); draw();
});
document.getElementById('duplicatePage').addEventListener('click', ()=>{
  addHistory();
  const copy = JSON.parse(JSON.stringify(currentPage()));
  // images cannot be cloned directly; reset handles and rebuild Image objects if needed.
  copy.objects.forEach(o=>{
    if (o.type==='image' && o.img) o.img = cloneImage(o.img);
  });
  state.pages.splice(state.pageIndex+1, 0, copy);
  state.pageIndex++;
  rebuildPages(); draw();
});
document.getElementById('deletePage').addEventListener('click', ()=>{
  if (state.pages.length<=1) { status('At least one page required.'); return; }
  addHistory();
  state.pages.splice(state.pageIndex,1);
  state.pageIndex = Math.max(0, state.pageIndex-1);
  rebuildPages(); draw();
});

function rebuildPages(){
  pagesList.innerHTML = '';
  state.pages.forEach((p, i)=>{
    const el = document.createElement('button');
    el.className = 'page-item' + (i===state.pageIndex ? ' active':'');
    el.innerHTML = `<span>Page ${i+1}</span><small>${p.width}×${p.height}</small>`;
    el.addEventListener('click', ()=>{
      state.pageIndex = i; state.selection = null; draw(); rebuildPages();
    });
    pagesList.appendChild(el);
  });
}

// Templates
document.querySelectorAll('[data-template]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const tpl = btn.getAttribute('data-template');
    applyTemplate(tpl);
  });
});

function applyTemplate(name){
  const p = currentPage();
  addHistory();
  // clear objects
  p.objects = [];

  // set size
  if (name==='poster'){ setPreset('poster'); }
  if (name==='insta'){ setPreset('insta'); }
  if (name==='thumb'){ setPreset('thumb'); }
  if (name==='flyer'){ setPreset('a4'); }

  // add sample layout
  const title = createBase('text');
  title.text = 'Your Big Title'; title.size = 96; title.fill = '#111827';
  title.w = p.width * 0.8; title.h = 240; title.x = p.width*0.1; title.y = 120;
  const bar = createBase('rect'); bar.w = p.width*0.6; bar.h = 24; bar.x = p.width*0.2; bar.y = 380; bar.fill='#8b5cf6';
  const body = createBase('text');
  body.text = 'Add a short description that invites curiosity.';
  body.size = 40; body.fill = '#334155'; body.w = p.width*0.8; body.h = 400; body.x = p.width*0.1; body.y = 440;

  p.objects.push(title, bar, body);
  draw();
}

// Preset sizes
const presetSize = document.getElementById('presetSize');
presetSize.addEventListener('change', ()=>{
  setPreset(presetSize.value);
});
function setPreset(key){
  const p = currentPage();
  addHistory();
  if (key==='a4'){ p.width = 2480; p.height = 3508; }
  if (key==='insta'){ p.width = 1080; p.height = 1080; }
  if (key==='story'){ p.width = 1080; p.height = 1920; }
  if (key==='thumb'){ p.width = 1280; p.height = 720; }
  if (key==='poster'){ p.width = 1080; p.height = 1350; }
  draw(); rebuildPages();
}

// Utility
function cloneImage(img){
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const cx = c.getContext('2d');
  cx.drawImage(img,0,0);
  const newImg = new Image();
  newImg.src = c.toDataURL('image/png');
  return newImg;
}

function drawHandles(o){
  // simple corner dots (visual only)
  ctx.fillStyle = '#22d3ee';
  const r = 5;
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(o.w,0,r,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(0,o.h,r,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(o.w,o.h,r,0,Math.PI*2); ctx.fill();
}

// Init
function init(){
  rebuildPages();
  draw();
  status('Tip: Hold Shift to rotate, Alt to resize while dragging.');
}
init();
