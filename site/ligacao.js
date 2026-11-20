/* Ligação da página ao Firebase: login, lista de acessos e dados partilhados (Firestore).
   Oferece à aplicação a mesma interface que ela usava na plataforma do Claude (window.claude.use),
   para que o resto do código não precise de mudar. Sem config.js preenchido, a página trabalha só neste navegador. */
(function () {
  'use strict';
  const CFG = window.CFG || {};
  const css = document.createElement('style');
  css.textContent = `
  .fat-blk{display:${CFG.leituraFaturas ? 'block' : 'none'}}
  #lgFundo,#acFundo{position:fixed;inset:0;z-index:100;background:var(--bg,#eef0ec);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
  #acFundo{background:rgba(0,0,0,.45)}
  .lg-cx{width:100%;max-width:380px;background:var(--panel,#fff);border:1px solid var(--line,#d6dbd5);border-radius:12px;padding:22px;display:flex;flex-direction:column;gap:12px;color:var(--ink,#17201c)}
  #acFundo .lg-cx{max-width:560px;max-height:calc(100vh - 32px);overflow:auto}
  .lg-cx h2{margin:0;font-size:18px}
  .lg-cx .lg-marca{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#5a6560);font-weight:600}
  .lg-cx p{margin:0;font-size:13px;color:var(--muted,#5a6560);line-height:1.45}
  .lg-cx label.lg-c{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}
  .lg-cx input[type=email],.lg-cx input[type=password]{font:inherit;font-weight:400;padding:9px 10px;border:1px solid var(--line,#d6dbd5);border-radius:8px;background:var(--panel,#fff);color:var(--ink,#17201c)}
  .lg-cx .lg-pri{font:inherit;font-weight:600;padding:10px;border-radius:8px;border:0;background:var(--accent,#1e5a4b);color:var(--accent-ink,#fff);cursor:pointer}
  .lg-cx .lg-sec{font:inherit;font-weight:600;padding:9px;border-radius:8px;border:1px solid var(--line,#d6dbd5);background:none;color:var(--ink,#17201c);cursor:pointer}
  .lg-cx button[disabled]{opacity:.6;cursor:default}
  .lg-cx .lg-links{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .lg-cx .lg-lk{font:inherit;font-size:13px;background:none;border:0;padding:0;color:var(--accent,#1e5a4b);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
  .lg-erro{color:var(--bad,#b42318);font-size:13px;min-height:1em}
  .lg-ok{color:var(--good,#1e7a4b);font-size:13px}
  #lgUser{position:relative;order:2}
  #lgUser>button{width:32px;height:32px;border-radius:50%;border:1px solid var(--line,#d6dbd5);background:var(--accent-soft,#ddebe5);color:var(--accent,#1e5a4b);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
  #lgMenu{position:absolute;right:0;top:38px;z-index:50;min-width:230px;background:var(--panel,#fff);border:1px solid var(--line,#d6dbd5);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:6px;display:flex;flex-direction:column}
  #lgMenu[hidden]{display:none}
  #lgMenu .lg-em{font-size:12px;color:var(--muted,#5a6560);padding:6px 10px 8px;border-bottom:1px solid var(--line2,#e6e9e4);margin-bottom:4px;word-break:break-all}
  #lgMenu button{font:inherit;font-size:13px;text-align:left;background:none;border:0;border-radius:6px;padding:8px 10px;color:var(--ink,#17201c);cursor:pointer}
  #lgMenu button:hover{background:var(--sunk,#f6f7f4)}
  .ac-lista{display:flex;flex-direction:column;border:1px solid var(--line2,#e6e9e4);border-radius:8px}
  .ac-l{display:flex;align-items:center;gap:10px;padding:8px 10px;border-top:1px solid var(--line2,#e6e9e4);font-size:13px}
  .ac-l:first-child{border-top:0}
  .ac-l .ac-e{flex:1;min-width:0;word-break:break-all}
  .ac-l label{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted,#5a6560)}
  .ac-l .ac-x{font:inherit;font-size:12px;background:none;border:1px solid var(--line,#d6dbd5);border-radius:6px;padding:3px 8px;color:var(--ink,#17201c);cursor:pointer}
  .ac-novo{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .ac-novo input[type=email]{flex:1;min-width:180px}
  .ac-topo{display:flex;justify-content:space-between;align-items:center;gap:8px}
  `;
  document.head.appendChild(css);

  if (!CFG.firebase || !CFG.firebase.apiKey || !window.firebase) {
    console.warn('Firebase não configurado: a página fica em modo local (dados só neste navegador).');
    return;
  }

  firebase.initializeApp(CFG.firebase);
  const auth = firebase.auth();
  const fs = firebase.firestore();
  if (CFG.emulador) {
    auth.useEmulator('http://127.0.0.1:' + (CFG.emulador.auth || 9099), { disableWarnings: true });
    fs.useEmulator('127.0.0.1', CFG.emulador.firestore || 8080);
  }
  auth.languageCode = 'pt';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = e => String(e || '').trim().toLowerCase();
  let utilizador = null, acesso = null, entrou = false;
  let resolverPronto;
  const pronto = new Promise(r => { resolverPronto = r; });

  /* ---------- ecrãs de entrada ---------- */
  function caixa(html) {
    let f = document.getElementById('lgFundo');
    if (!f) { f = document.createElement('div'); f.id = 'lgFundo'; document.body.appendChild(f); }
    f.innerHTML = `<div class="lg-cx" role="dialog" aria-modal="true" aria-labelledby="lgTit"><span class="lg-marca">Movecho · Custeamento semanal</span>${html}</div>`;
    const first = f.querySelector('input,button.lg-pri');
    setTimeout(() => first && first.focus(), 0);
    return f;
  }
  const erroAuth = e => {
    const c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'Email ou palavra-passe errados.';
    if (/email-already-in-use/.test(c)) return 'Este email já tem palavra-passe. Use Entrar, ou “Esqueci-me da palavra-passe”.';
    if (/weak-password/.test(c)) return 'A palavra-passe tem de ter pelo menos 8 caracteres.';
    if (/invalid-email/.test(c)) return 'O email não é válido.';
    if (/too-many-requests/.test(c)) return 'Demasiadas tentativas. Espere uns minutos e tente outra vez.';
    if (/network/.test(c)) return 'Sem ligação à internet.';
    if (/operation-not-allowed/.test(c)) return 'O login por email ainda não está ligado no Firebase.';
    return 'Não foi possível concluir. Tente outra vez.';
  };
  function ecraEntrar(msg, email) {
    const f = caixa(`<h2 id="lgTit">Entrar</h2>
      <form class="lg-f" style="display:flex;flex-direction:column;gap:12px" autocomplete="on">
        <label class="lg-c">Email<input type="email" name="email" autocomplete="username" required value="${esc(email || '')}"></label>
        <label class="lg-c">Palavra-passe<input type="password" name="pw" autocomplete="current-password" required></label>
        <div class="lg-erro" role="alert">${esc(msg || '')}</div>
        <button type="submit" class="lg-pri">Entrar</button>
      </form>
      <div class="lg-links"><button type="button" class="lg-lk" data-ir="criar">Primeiro acesso</button><button type="button" class="lg-lk" data-ir="recuperar">Esqueci-me da palavra-passe</button></div>`);
    ligarLinks(f);
    f.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fm = ev.target, b = fm.querySelector('button'), er = fm.querySelector('.lg-erro');
      b.disabled = true; er.textContent = '';
      try { await auth.signInWithEmailAndPassword(norm(fm.email.value), fm.pw.value); }
      catch (e) { er.textContent = erroAuth(e); b.disabled = false; }
    });
  }
  function ecraCriar(msg) {
    const f = caixa(`<h2 id="lgTit">Primeiro acesso</h2>
      <p>Use o email que o responsável acrescentou à plataforma e escolha uma palavra-passe.</p>
      <form class="lg-f" style="display:flex;flex-direction:column;gap:12px" autocomplete="on">
        <label class="lg-c">Email<input type="email" name="email" autocomplete="username" required></label>
        <label class="lg-c">Palavra-passe (mínimo 8 caracteres)<input type="password" name="pw" autocomplete="new-password" minlength="8" required></label>
        <label class="lg-c">Repetir a palavra-passe<input type="password" name="pw2" autocomplete="new-password" minlength="8" required></label>
        <div class="lg-erro" role="alert">${esc(msg || '')}</div>
        <button type="submit" class="lg-pri">Criar acesso</button>
      </form>
      <div class="lg-links"><button type="button" class="lg-lk" data-ir="entrar">Já tenho palavra-passe</button></div>`);
    ligarLinks(f);
    f.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fm = ev.target, b = fm.querySelector('button'), er = fm.querySelector('.lg-erro');
      if (fm.pw.value.length < 8) { er.textContent = 'A palavra-passe tem de ter pelo menos 8 caracteres.'; return; }
      if (fm.pw.value !== fm.pw2.value) { er.textContent = 'As duas palavras-passe não são iguais.'; return; }
      b.disabled = true; er.textContent = '';
      try {
        await auth.createUserWithEmailAndPassword(norm(fm.email.value), fm.pw.value);
      } catch (e) { er.textContent = erroAuth(e); b.disabled = false; }
    });
  }
  function ecraRecuperar(msg) {
    const f = caixa(`<h2 id="lgTit">Nova palavra-passe</h2>
      <p>Enviamos um link para escolher uma palavra-passe nova.</p>
      <form class="lg-f" style="display:flex;flex-direction:column;gap:12px">
        <label class="lg-c">Email<input type="email" name="email" autocomplete="username" required></label>
        <div class="lg-erro" role="alert">${esc(msg || '')}</div>
        <button type="submit" class="lg-pri">Enviar link</button>
      </form>
      <div class="lg-links"><button type="button" class="lg-lk" data-ir="entrar">Voltar a Entrar</button></div>`);
    ligarLinks(f);
    f.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fm = ev.target, b = fm.querySelector('button'), er = fm.querySelector('.lg-erro');
      b.disabled = true; er.textContent = '';
      try { await auth.sendPasswordResetEmail(norm(fm.email.value)); }
      catch (e) { if (!/user-not-found/.test(e.code || '')) { er.textContent = erroAuth(e); b.disabled = false; return; } }
      ecraEntrar('', fm.email.value);
      const ok = document.createElement('p'); ok.className = 'lg-ok';
      ok.textContent = 'Se o email tiver acesso, recebe o link em poucos minutos (veja também o spam).';
      document.querySelector('#lgFundo .lg-erro').before(ok);
    });
  }
  function ecraVerificar(u, msg) {
    const f = caixa(`<h2 id="lgTit">Confirme o seu email</h2>
      <p>Enviámos um link de confirmação para <b>${esc(u.email)}</b>. Abra-o (veja também o spam) e volte aqui.</p>
      <div class="lg-erro" role="alert">${esc(msg || '')}</div>
      <button type="button" class="lg-pri" data-v="ok">Já confirmei</button>
      <div class="lg-links"><button type="button" class="lg-lk" data-v="reenviar">Reenviar email</button><button type="button" class="lg-lk" data-v="sair">Sair</button></div>`);
    f.querySelector('[data-v=ok]').addEventListener('click', async ev => {
      ev.target.disabled = true;
      try { await u.reload(); } catch (e) { /* sem rede */ }
      if (auth.currentUser && auth.currentUser.emailVerified) { await auth.currentUser.getIdToken(true); verificarAcesso(auth.currentUser); }
      else ecraVerificar(u, 'O email ainda não está confirmado.');
    });
    f.querySelector('[data-v=reenviar]').addEventListener('click', async () => {
      try { await u.sendEmailVerification(); ecraVerificar(u, ''); f.querySelector('.lg-erro').outerHTML = '<p class="lg-ok">Email reenviado.</p>'; }
      catch (e) { ecraVerificar(u, erroAuth(e)); }
    });
    f.querySelector('[data-v=sair]').addEventListener('click', () => auth.signOut());
  }
  function ecraSemAcesso(u, msg) {
    const f = caixa(`<h2 id="lgTit">Sem acesso</h2>
      <p>O email <b>${esc(u.email)}</b> ainda não está na lista de acessos. Peça ao responsável da plataforma para o acrescentar.</p>
      <div class="lg-erro" role="alert">${esc(msg || '')}</div>
      <button type="button" class="lg-pri" data-v="ok">Tentar outra vez</button>
      <div class="lg-links"><button type="button" class="lg-lk" data-v="sair">Sair</button></div>`);
    f.querySelector('[data-v=ok]').addEventListener('click', () => verificarAcesso(u));
    f.querySelector('[data-v=sair]').addEventListener('click', () => auth.signOut());
  }
  function ligarLinks(f) {
    f.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => {
      ({ entrar: ecraEntrar, criar: ecraCriar, recuperar: ecraRecuperar })[b.dataset.ir]();
    }));
  }

  async function verificarAcesso(u) {
    let snap;
    try { snap = await fs.doc('acessos/' + norm(u.email)).get(); }
    catch (e) {
      if (/permission/.test(e.code || '')) { ecraSemAcesso(u); return; }
      ecraSemAcesso(u, 'Sem ligação aos dados. Verifique a internet.'); return;
    }
    if (!snap.exists) { ecraSemAcesso(u); return; }
    acesso = snap.data() || {};
    utilizador = u;
    document.getElementById('lgFundo')?.remove();
    if (!entrou) { entrou = true; mostrarUtilizador(); resolverPronto(); }
  }

  auth.onAuthStateChanged(u => {
    if (!u) {
      if (entrou) { location.reload(); return; }
      ecraEntrar();
      return;
    }
    // a confirmação do email não é exigida (os emails do Firebase não chegavam às caixas da empresa);
    // o acesso continua a depender da lista "acessos", gerida pelos administradores
    if (CFG.exigirConfirmacao && !u.emailVerified) { ecraVerificar(u); return; }
    verificarAcesso(u);
  });

  /* ---------- menu do utilizador ---------- */
  function mostrarUtilizador() {
    if (document.getElementById('lgUser')) return;
    const top = document.querySelector('header.top');
    if (!top) return;
    const em = utilizador.email || '';
    const ini = (em.split('@')[0].split(/[._-]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase();
    const el = document.createElement('div');
    el.id = 'lgUser';
    el.innerHTML = `<button type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Conta: ${esc(em)}" title="${esc(em)}">${esc(ini)}</button>
      <div id="lgMenu" role="menu" hidden><div class="lg-em">${esc(em)}</div>
      ${acesso.admin ? '<button type="button" role="menuitem" data-m="acessos">Gerir acessos</button>' : ''}
      <button type="button" role="menuitem" data-m="pw">Mudar palavra-passe</button>
      <button type="button" role="menuitem" data-m="sair">Sair</button></div>`;
    const logo = top.querySelector('.logo');
    if (logo) top.insertBefore(el, logo); else top.appendChild(el);
    const btn = el.firstElementChild, menu = el.querySelector('#lgMenu');
    const abrir = v => { menu.hidden = !v; btn.setAttribute('aria-expanded', String(v)); };
    btn.addEventListener('click', ev => { ev.stopPropagation(); abrir(menu.hidden); });
    document.addEventListener('click', ev => { if (!el.contains(ev.target)) abrir(false); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') abrir(false); });
    menu.addEventListener('click', async ev => {
      const m = ev.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      abrir(false);
      if (m === 'sair') { await auth.signOut(); return; }
      if (m === 'pw') {
        try { await auth.sendPasswordResetEmail(em); window.alert('Enviámos um link para ' + em + ' para escolher a palavra-passe nova.'); }
        catch (e) { window.alert(erroAuth(e)); }
        return;
      }
      if (m === 'acessos') gerirAcessos();
    });
  }

  /* ---------- lista de acessos (só administradores) ---------- */
  function gerirAcessos() {
    const eu = norm(utilizador.email);
    const f = document.createElement('div');
    f.id = 'acFundo';
    f.innerHTML = `<div class="lg-cx" role="dialog" aria-modal="true" aria-labelledby="acTit">
      <div class="ac-topo"><h2 id="acTit">Acessos</h2><button type="button" class="lg-sec" data-ac="fechar">Fechar</button></div>
      <p>Depois de acrescentar um email, a pessoa abre a plataforma e escolhe “Primeiro acesso”.</p>
      <form class="ac-novo"><input type="email" name="email" placeholder="nome@movecho.pt" required aria-label="Email a acrescentar">
        <label style="display:flex;gap:4px;align-items:center;font-size:13px"><input type="checkbox" name="admin"> Administrador</label>
        <button type="submit" class="lg-pri">Acrescentar</button></form>
      <div class="lg-erro" role="alert"></div>
      <div class="ac-lista"><div class="ac-l">A carregar…</div></div></div>`;
    document.body.appendChild(f);
    const er = f.querySelector('.lg-erro'), lista = f.querySelector('.ac-lista');
    const falha = e => { er.textContent = /permission/.test(e.code || '') ? 'Só um administrador pode mudar os acessos.' : 'Não foi possível guardar. Verifique a internet.'; };
    const parar = fs.collection('acessos').onSnapshot(qs => {
      const docs = qs.docs.slice().sort((a, b) => a.id.localeCompare(b.id));
      lista.innerHTML = docs.map(d => {
        const a = d.data() || {}, mim = d.id === eu;
        return `<div class="ac-l"><span class="ac-e">${esc(d.id)}${mim ? ' (eu)' : ''}</span>
          <label><input type="checkbox" data-adm="${esc(d.id)}" ${a.admin ? 'checked' : ''} ${mim ? 'disabled' : ''}> Administrador</label>
          ${mim ? '' : `<button type="button" class="ac-x" data-rem="${esc(d.id)}">Remover</button>`}</div>`;
      }).join('') || '<div class="ac-l">Ainda não há emails.</div>';
    }, falha);
    const fechar = () => { parar(); f.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = ev => { if (ev.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc_);
    f.addEventListener('click', async ev => {
      if (ev.target === f || ev.target.dataset.ac === 'fechar') { fechar(); return; }
      const rem = ev.target.dataset.rem;
      if (rem) {
        if (!window.confirm('Remover o acesso de ' + rem + '?')) return;
        er.textContent = '';
        try { await fs.doc('acessos/' + rem).delete(); } catch (e) { falha(e); }
      }
    });
    f.addEventListener('change', async ev => {
      const id = ev.target.dataset.adm;
      if (!id) return;
      er.textContent = '';
      try { await fs.doc('acessos/' + id).set({ admin: ev.target.checked }, { merge: true }); } catch (e) { falha(e); ev.target.checked = !ev.target.checked; }
    });
    f.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const fm = ev.target, email = norm(fm.email.value);
      er.textContent = '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { er.textContent = 'O email não é válido.'; return; }
      try {
        await fs.doc('acessos/' + email).set({ admin: fm.admin.checked, acrescentadoPor: eu, em: firebase.firestore.FieldValue.serverTimestamp() });
        fm.reset();
      } catch (e) { falha(e); }
    });
  }

  /* ---------- dados partilhados, com cópias no histórico ---------- */
  const HIST_MIN = 15 * 60 * 1000;
  const ultimaCopia = {};
  function guardarHistorico(path, data) {
    const k = 'custeamento-hist:' + path;
    let t = ultimaCopia[path] || 0;
    try { t = Math.max(t, +localStorage.getItem(k) || 0); } catch { /* sem armazenamento */ }
    const agora = Date.now();
    if (agora - t < HIST_MIN) return;
    ultimaCopia[path] = agora;
    try { localStorage.setItem(k, String(agora)); } catch { /* sem armazenamento */ }
    fs.collection('historico').add({ caminho: path, dados: data, por: norm(utilizador && utilizador.email), em: firebase.firestore.FieldValue.serverTimestamp() })
      .catch(e => console.warn('histórico', e));
  }
  const db = {
    doc(path) {
      const ref = fs.doc(path);
      return {
        async set(data) { await ref.set(data); guardarHistorico(path, data); },
        async delete() { await ref.delete(); },
        onSnapshot(cb, onErr) { return ref.onSnapshot(cb, onErr); }
      };
    },
    collection(nome) {
      const ref = fs.collection(nome);
      return { onSnapshot(cb, onErr) { return ref.onSnapshot(cb, onErr); } };
    }
  };

  /* ---------- descargas: link normal do navegador ---------- */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/.test(filename) ? 'text/csv;charset=utf-8' : /\.html$/.test(filename) ? 'text/html;charset=utf-8' : 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
  };

  window.claude = {
    async use(nome) {
      if (nome === 'downloads') return downloads;
      if (nome === 'db') { await pronto; return db; }
      return null; // leitura de faturas e anexos: ainda não ativos nesta versão
    }
  };
})();
