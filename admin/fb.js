// Conecta la herramienta con Firebase: entrada con Google, base de datos Firestore y fotos.
// Ofrece la misma interfaz que tenía dentro de Claude (window.claude.use) para que la app no cambie.
(() => {
const V = '10.14.1', CDN = `https://www.gstatic.com/firebasejs/${V}/`;
let F = null, fs = null, auth = null, me = null, acceso = null, owner = false;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- pantalla de entrada ----------
const css = `
.gate{position:fixed;inset:0;z-index:90;background:var(--bg);display:grid;place-items:center;padding:24px}
.gate-box{width:min(380px,100%);background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:24px;display:grid;gap:14px;text-align:center;box-shadow:var(--shadow)}
.gate-box h1{margin:0;font:700 1.7rem/1 var(--f-display);text-transform:uppercase;letter-spacing:.02em}
.gate-box h1 span{color:var(--accent)}
.gate-box p{margin:0;color:var(--muted)}
.gate-box .btn{justify-self:center;padding:12px 20px;font-size:1rem}
.acct{position:absolute;top:8px;right:max(8px,env(safe-area-inset-right,0px));border:0;background:transparent;color:var(--muted);font-size:1.35rem;padding:6px 8px;line-height:1}
.panel-bg{position:fixed;inset:0;z-index:80;background:rgba(10,12,16,.45);display:grid;place-items:center;padding:16px}
.panel{width:min(520px,100%);max-height:100%;overflow:auto;background:var(--surface);border-radius:14px;box-shadow:var(--shadow);padding:16px;display:grid;gap:16px}
.panel h3{margin:0;font:700 1.2rem/1 var(--f-display);text-transform:uppercase;letter-spacing:.04em}
.panel h4{margin:0 0 6px;font:700 .85rem/1 var(--f-display);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.panel .em{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}
`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

function gate(html){
  let g = $('gate');
  if (!g){ g = document.createElement('div'); g.id='gate'; g.className='gate'; document.body.appendChild(g); }
  g.innerHTML = `<div class="gate-box"><h1>DC Racing <span>·</span> Inventario</h1>${html}</div>`;
  g.hidden = false; return g;
}
function hideGate(){ const g=$('gate'); if (g) g.hidden = true; }
function showLogin(msg){
  const g = gate(`<p>${esc(msg || 'Entra con la cuenta de Google que autorizó la tienda.')}</p><button class="btn primary" type="button" id="gIn">Entrar con Google</button>`);
  g.querySelector('#gIn').onclick = async () => {
    const p = new F.GoogleAuthProvider(); p.setCustomParameters({prompt:'select_account'});
    try { await F.signInWithPopup(auth, p); }
    catch(e){
      if (e && (e.code==='auth/popup-blocked' || e.code==='auth/operation-not-supported-in-this-environment')) return F.signInWithRedirect(auth, p);
      if (e && e.code!=='auth/popup-closed-by-user' && e.code!=='auth/cancelled-popup-request') showLogin('No se pudo entrar: '+(e.message||e.code));
    }
  };
}
function showDenied(){
  const g = gate(`<p>La cuenta <b>${esc(me && me.email)}</b> no tiene acceso a la herramienta.</p><p>Pide al dueño de la tienda que agregue tu correo y vuelve a entrar.</p><button class="btn" type="button" id="gOut">Entrar con otra cuenta</button>`);
  g.querySelector('#gOut').onclick = () => F.signOut(auth).then(()=>location.reload());
}

// ---------- arranque ----------
gate('<p>Cargando…</p>');
const ready = (async () => {
  const mods = await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(m => import(CDN+m)));
  F = Object.assign({}, ...mods);
  const app = F.initializeApp(window.FIREBASE_CONFIG);
  auth = F.getAuth(app);
  try { fs = F.initializeFirestore(app, {ignoreUndefinedProperties:true, localCache: F.persistentLocalCache({tabManager: F.persistentMultipleTabManager()})}); }
  catch(_) { fs = F.initializeFirestore(app, {ignoreUndefinedProperties:true}); }
  me = await new Promise(res => F.onAuthStateChanged(auth, u => { if (u) res(u); else showLogin(); }));
  gate('<p>Comprobando acceso…</p>');
  try {
    const ref = F.doc(fs,'config','acceso');
    const s = await F.getDocFromServer(ref).catch(e => { if (e && e.code==='unavailable') return F.getDoc(ref); throw e; });
    if (s.exists()) acceso = s.data();
    else { acceso = {owner: me.email, emails: [me.email]}; await F.setDoc(ref, acceso); }   // solo el dueño puede leer un acceso vacío
  } catch(e){ showDenied(); throw e; }
  owner = acceso.owner === me.email;
  hideGate(); addAccountButton();
  return true;
})();
ready.catch(()=>{});

// ---------- adaptador de base de datos (misma forma que la de Claude) ----------
const wrapSnap = s => ({docs: s.docs.map(d => ({id:d.id, data:()=>d.data()}))});
function query(ref){
  return {
    where: (f,op,v) => query(F.query(ref, F.where(f,op,v))),
    orderBy: (f,dir) => query(F.query(ref, F.orderBy(f,dir))),
    limit: n => query(F.query(ref, F.limit(n))),
    get: async () => wrapSnap(await F.getDocs(ref)),
    onSnapshot: (fn, err) => F.onSnapshot(ref, s => fn(wrapSnap(s)), err),
  };
}
const db = {
  collection(name){
    const c = F.collection(fs, name);
    return Object.assign(query(c), {
      doc(id){
        const r = F.doc(fs, name, id);
        return {
          get: async () => { const s = await F.getDoc(r); return {exists: s.exists(), data: () => s.data()}; },
          set: d => F.setDoc(r, d),
          update: d => F.setDoc(r, d, {merge:true}),   // mezcla profunda, como la base de Claude
          delete: () => F.deleteDoc(r),
        };
      },
      add: async d => ({id: (await F.addDoc(c, d)).id}),
    });
  },
};

// ---------- fotos tomadas en la herramienta: se guardan comprimidas en Firestore ----------
const FOTOS = {}, FOTOP = {};
const toDataUrl = b => new Promise((ok,ko) => { const r=new FileReader(); r.onload=()=>ok(r.result); r.onerror=ko; r.readAsDataURL(b); });
async function shrink(blob, max){
  const img = await createImageBitmap(blob);
  const s = Math.min(1, max/Math.max(img.width, img.height));
  const cv = document.createElement('canvas'); cv.width=Math.round(img.width*s); cv.height=Math.round(img.height*s);
  cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
  return new Promise(r => cv.toBlob(r, 'image/jpeg', .78));
}
const assets = {
  async upload(blob){
    let b = await shrink(blob, 900);
    if (b.size > 700000) b = await shrink(blob, 600);
    const url = await toDataUrl(b);
    const ref = await F.addDoc(F.collection(fs,'fotos'), {d: url.split(',')[1], t: new Date().toISOString(), por: me.uid});
    FOTOS[ref.id] = url;
    return {id: ref.id, url, sizeBytes: b.size, contentType: 'image/jpeg'};
  },
};
window.fotoPeek = id => FOTOS[id] || null;
window.fotoGet = id => {
  if (!FOTOP[id]) FOTOP[id] = ready.then(() => F.getDoc(F.doc(fs,'fotos',id))).then(s => { const d = s.exists() && s.data().d; return FOTOS[id] = d ? 'data:image/jpeg;base64,'+d : null; }).catch(() => null);
  return FOTOP[id];
};

const downloads = {
  async save({filename, data}){
    const blob = data instanceof Blob ? data : new Blob([data], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  },
};
const user = {
  id: async () => me.uid,
  me: async () => ({id: me.uid, name: me.displayName || me.email, email: me.email}),
  isOwner: () => owner,
  canEdit: () => owner,
  can: () => true,
};

window.claude = {use: name => ready.then(() => ({db, user, assets, downloads})[name] || null).catch(() => null)};

// Catálogo y compras a BRG viven en Firestore (no en archivos públicos, porque llevan costos)
window.loadData = async name => {
  await ready;
  if (name === 'brg'){ const s = await F.getDoc(F.doc(fs,'catalogo','_brg')); return s.exists() ? JSON.parse(s.data().json) : {}; }
  const snap = await F.getDocs(F.collection(fs,'catalogo'));
  const docs = {}; snap.docs.forEach(d => docs[d.id] = d.data());
  const meta = docs._meta;
  if (!meta){
    setTimeout(() => { const n=$('notice'); if (n){ n.hidden=false; n.textContent = owner ? 'Todavía no hay catálogo. Abre ⚙ (arriba a la derecha) → Importar datos.' : 'Todavía no se ha cargado el catálogo.'; } }, 0);
    return {categorias:{}, productos:[]};
  }
  return {categorias: meta.categorias, productos: meta.orden.flatMap(p => (docs[p] && docs[p].p) || [])};
};

// ---------- cuenta, usuarios autorizados e importación ----------
function addAccountButton(){
  const brand = document.querySelector('header.top'); if (!brand || $('acctBtn')) return;
  const b = document.createElement('button'); b.id='acctBtn'; b.className='acct'; b.type='button'; b.title='Cuenta y ajustes'; b.textContent='⚙';
  b.onclick = openPanel; brand.appendChild(b);
}
function openPanel(){
  const bg = document.createElement('div'); bg.className='panel-bg';
  bg.innerHTML = `<div class="panel" role="dialog" aria-modal="true">
    <div style="display:flex;justify-content:space-between;align-items:center"><h3>Cuenta</h3><button class="x" type="button" data-x aria-label="Cerrar">×</button></div>
    <div><span class="hint">Entraste como</span><br><b>${esc(me.email)}</b>${owner?' · dueño':''}</div>
    ${owner ? `<div><h4>Personas con acceso</h4><div id="pEm"></div>
      <form class="search" id="pAdd" style="margin-top:8px"><input id="pMail" type="email" placeholder="correo@gmail.com" required><button class="btn" type="submit">Agregar</button></form></div>
      <div><h4>Importar datos</h4><p class="hint" style="margin:0 0 8px">Carga el archivo <b>importar.json</b> que te preparó Claude (catálogo, cambios, ventas e inventarios).</p>
      <label class="btn filebtn"><span>Elegir archivo</span><input id="pFile" type="file" accept=".json,application/json"></label><p class="hint" id="pMsg"></p></div>` : ''}
    <div><button class="btn" type="button" id="pOut">Cerrar sesión</button></div></div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target===bg || e.target.closest('[data-x]')) close(); });
  bg.querySelector('#pOut').onclick = () => F.signOut(auth).then(()=>location.reload());
  if (!owner) return;
  const ref = F.doc(fs,'config','acceso');
  const draw = () => { bg.querySelector('#pEm').innerHTML = acceso.emails.map(m => `<div class="em"><span>${esc(m)}</span>${m===acceso.owner?'<span class="hint">dueño</span>':`<button class="btn sm" type="button" data-rm="${esc(m)}">Quitar</button>`}</div>`).join(''); };
  draw();
  bg.querySelector('#pEm').addEventListener('click', async e => {
    const m = e.target.dataset.rm; if (!m) return;
    acceso.emails = acceso.emails.filter(x => x!==m); await F.setDoc(ref, acceso); draw();
  });
  bg.querySelector('#pAdd').addEventListener('submit', async e => {
    e.preventDefault(); const m = bg.querySelector('#pMail').value.trim().toLowerCase(); if (!m || acceso.emails.includes(m)) return;
    acceso.emails = [...acceso.emails, m]; await F.setDoc(ref, acceso); bg.querySelector('#pMail').value=''; draw();
  });
  bg.querySelector('#pFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value=''; if (!f) return;
    const msg = bg.querySelector('#pMsg');
    try { await importAll(JSON.parse(await f.text()), t => msg.textContent = t); msg.textContent = 'Listo. Recargando…'; setTimeout(()=>location.reload(), 1200); }
    catch(err){ msg.textContent = 'No se pudo importar: '+(err.message||err); }
  });
}
async function importAll(data, progress){
  if (!data || data.version !== 1) throw new Error('el archivo no es un importar.json válido');
  const writes = [];   // [ruta, documento]
  const cat = data.catalogo, orden = [];
  const byPref = {};
  for (const p of cat.productos){ const k = p.c.split('-')[0]; if (!byPref[k]){ byPref[k]=[]; orden.push(k); } byPref[k].push(p); }
  for (const k of orden) writes.push([['catalogo',k], {p: byPref[k]}]);
  writes.push([['catalogo','_meta'], {categorias: cat.categorias, orden}]);
  if (data.brg) writes.push([['catalogo','_brg'], {json: JSON.stringify(data.brg)}]);
  for (const [col, docs] of Object.entries(data.colecciones || {})) for (const [id, d] of Object.entries(docs)) writes.push([[col,id], d]);
  let batch = F.writeBatch(fs), n = 0, bytes = 0, done = 0;
  for (const [[c,id], d] of writes){
    const size = JSON.stringify(d).length;
    if (n >= 400 || bytes + size > 8e6){ await batch.commit(); batch = F.writeBatch(fs); n = 0; bytes = 0; progress(`Guardando… ${done} de ${writes.length}`); }
    batch.set(F.doc(fs, c, id), d); n++; bytes += size; done++;
  }
  if (n) await batch.commit();
  progress(`Guardados ${writes.length} documentos.`);
}
})();
