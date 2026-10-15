/* ═══════════════════════════════════════════════════════════════════════
   speech-lessico.js — parlato per i file lessico-uN.html (Grammar Quest)
   Si include con UNA riga subito prima di </body>, DOPO lo script del motore:
   <script src="https://cristinavallini64-maker.github.io/grammar-tutor/speech-lessico.js"></script>

   Cosa aggiunge (senza toccare dati, punteggi, tracking, save code):
   1. Esercizi: 🎤 per rispondere a voce (il testo riconosciuto va nella casella);
      dopo CONTROLLA si sente la parola corretta;
      pulsanti 🔊 / 🐢 per riascoltarla.
   2. Mappa: pannello PRONUNCIA con due modalità per ogni livello di studio:
      - ASCOLTA E RIPETI: senti la parola e la ripeti al microfono;
      - DILLO TU: vedi l'italiano e dici la parola inglese, poi la senti.
      Nessun voto: è allenamento. Dopo 3 tentativi si va avanti comunque.
   Usa solo le funzioni del browser (sintesi e riconoscimento vocale): gratis.
   Il riconoscimento funziona su Chrome / Edge (anche Android); se manca,
   i pulsanti 🎤 spariscono e restano l'ascolto e il pulsante MOSTRA.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof LEVELS === 'undefined' || typeof renderExercise !== 'function') return;

  // ─── Sintesi vocale ────────────────────────────────────────────────────
  const synth = window.speechSynthesis || null;
  let voice = null;
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices();
    const gb = vs.filter(v => /^en[-_]GB/i.test(v.lang));
    const en = vs.filter(v => /^en/i.test(v.lang));
    const pref = l => l.find(v => /google|natural|online|neural|daniel|serena|kate/i.test(v.name)) || l[0];
    voice = pref(gb) || pref(en) || null;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

  // pulizia per la lettura: (opzioni/tra/barre) e (___) via, a / b → a, b
  function clean(t) {
    return String(t)
      .replace(/\s*\((?:[^()]*\/[^()]*|_+)\)\s*/g, ' ')
      .replace(/\s*\/\s*/g, ', ')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function speakText(t, slow) {
    if (!synth || !t) return;
    t = clean(t);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = voice ? voice.lang : 'en-GB';
    if (voice) u.voice = voice;
    u.rate = slow ? 0.65 : 0.95;
    synth.speak(u);
  }

  // ─── Riconoscimento vocale ─────────────────────────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let rec = null, recBusy = false;

  function listen(onResult, onState) {
    if (!SR) return;
    if (recBusy && rec) { try { rec.stop(); } catch (e) {} return; }
    if (synth) synth.cancel();
    rec = new SR();
    rec.lang = 'en-GB';
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    let got = false;
    rec.onstart = () => { recBusy = true; onState('listening'); };
    rec.onresult = ev => {
      got = true;
      const alts = [];
      const r = ev.results[0];
      for (let i = 0; i < r.length; i++) alts.push(r[i].transcript);
      onResult(alts);
    };
    rec.onerror = ev => {
      got = true;
      onState(ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'denied'
            : ev.error === 'no-speech' ? 'nospeech' : 'error');
    };
    rec.onend = () => { recBusy = false; onState(got ? 'idle' : 'nospeech'); };
    try { rec.start(); } catch (e) { recBusy = false; onState('error'); }
  }

  const STATE_MSG = {
    listening: '🎤 Ti ascolto… parla ora',
    denied: '⚠ Il microfono è bloccato: consenti l\'uso del microfono al browser',
    nospeech: 'Non ho sentito niente: premi 🎤 e riprova',
    error: 'Il microfono non ha funzionato: riprova'
  };

  // confronto tollerante: maiuscole, punteggiatura, trattini, contrazioni
  function key(s) { return norm(String(s).replace(/[-–—]/g, ' ')).replace(/\s+/g, ' ').trim(); }
  function findMatch(alts, accepts) {
    const ak = accepts.map(a => ({ a, k: key(a) }));
    for (const t of alts) { const m = ak.find(x => x.k === key(t)); if (m) return m.a; }
    return null;
  }

  // ─── Preferenza: audio automatico dopo CONTROLLA ──────────────────────
  const AK = 'gq_speech_auto';
  let auto = true;
  try { auto = localStorage.getItem(AK) !== '0'; } catch (e) {}

  // ─── Stili ─────────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
.sp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;}
.sp-btn{font-family:'Orbitron',monospace;font-size:11px;font-weight:700;letter-spacing:1px;padding:9px 14px;border-radius:var(--radius-sm,6px);border:1px solid rgba(0,240,255,0.45);background:rgba(0,180,255,0.12);color:var(--cyan,#00f0ff);cursor:pointer;transition:all .2s;}
.sp-btn:hover{background:rgba(0,180,255,0.25);}
.sp-btn.mic{border-color:rgba(255,204,0,0.5);background:rgba(255,204,0,0.12);color:var(--gold,#ffcc00);}
.sp-btn.mic.on{background:rgba(255,77,109,0.25);border-color:var(--red,#ff4d6d);color:#fff;animation:spPulse 1s infinite;}
@keyframes spPulse{50%{box-shadow:0 0 14px rgba(255,77,109,0.7);}}
.sp-status{font-size:14px;color:var(--text-dim,#ccc);min-height:18px;}
.sp-toggle{font-family:'Orbitron',monospace;font-size:9px;letter-spacing:1px;padding:7px 12px;border:1px solid rgba(0,240,255,0.35);background:rgba(0,240,255,0.07);color:var(--text-dim,#ccc);border-radius:var(--radius-sm,6px);cursor:pointer;margin-right:8px;}
.sp-panel{background:var(--surface);border:1px solid rgba(255,204,0,0.35);border-radius:var(--radius,12px);padding:16px 18px;margin:0 0 20px;}
.sp-panel-title{font-family:'Orbitron',monospace;font-size:11px;letter-spacing:2px;color:var(--gold,#ffcc00);margin-bottom:4px;}
.sp-panel-sub{font-size:13px;color:var(--text-muted);margin-bottom:12px;}
.sp-lv{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0;border-top:1px solid rgba(255,255,255,0.07);}
.sp-lv-name{flex:1 1 200px;font-size:14px;font-weight:600;}
.sp-word{font-size:40px;font-weight:700;text-align:center;margin:18px 0 6px;line-height:1.15;word-break:break-word;}
.sp-it{font-size:19px;text-align:center;color:var(--text-dim);}
.sp-big{font-size:26px;text-align:center;color:var(--text-dim);margin:24px 0 6px;}
.sp-fb{text-align:center;font-size:17px;min-height:26px;margin-top:14px;}
.sp-fb.ok{color:var(--green,#00ff88);} .sp-fb.err{color:var(--red,#ff4d6d);}
.sp-center{justify-content:center;}
.sp-note{font-size:12px;color:var(--text-muted);text-align:center;margin-top:18px;}
@media(max-width:560px){.sp-word{font-size:30px;}}
`;
  document.head.appendChild(css);

  // ─── Pulsante header: audio automatico ON/OFF ─────────────────────────
  const resetBtn = document.querySelector('header .btn-reset');
  if (resetBtn && synth) {
    const t = document.createElement('button');
    t.className = 'sp-toggle';
    const paint = () => { t.textContent = auto ? '🔊 AUDIO ON' : '🔇 AUDIO OFF'; };
    paint();
    t.title = 'Ascolta automaticamente la risposta corretta dopo CONTROLLA';
    t.onclick = () => { auto = !auto; try { localStorage.setItem(AK, auto ? '1' : '0'); } catch (e) {} paint(); if (!auto && synth) synth.cancel(); };
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    resetBtn.parentNode.insertBefore(wrap, resetBtn);
    wrap.appendChild(t); wrap.appendChild(resetBtn);
  }

  // ─── 1. Esercizi ───────────────────────────────────────────────────────
  // si legge solo la parola / espressione della risposta (anche nei gap fill)
  function exSpeech(ex) { return ex ? ex.a : ''; }

  const _render = renderExercise;
  renderExercise = function () {
    _render.apply(this, arguments);
    const ex = exQueue[exIdx];
    const inp = document.getElementById('fillInput');
    if (!ex || !inp || !SR) return;
    const row = document.createElement('div');
    row.className = 'sp-row';
    row.innerHTML = '<button class="sp-btn mic" id="spMic" type="button">🎤 RISPONDI A VOCE</button><span class="sp-status" id="spStatus"></span>';
    inp.insertAdjacentElement('afterend', row);
    const mic = row.querySelector('#spMic'), st = row.querySelector('#spStatus');
    mic.onclick = () => {
      if (exChecked) return;
      listen(alts => {
        const m = findMatch(alts, ex.accept || [ex.a]);
        inp.value = m || alts[0] || '';
        st.textContent = 'Ho capito: «' + (alts[0] || '') + '» — controlla e premi ▶ CONTROLLA';
      }, s => {
        mic.classList.toggle('on', s === 'listening');
        if (s !== 'idle') st.textContent = STATE_MSG[s] || '';
      });
    };
  };

  const _check = checkExercise;
  checkExercise = function () {
    const was = exChecked;
    _check.apply(this, arguments);
    if (was || !exChecked) return;
    if (recBusy && rec) { try { rec.stop(); } catch (e) {} }
    const ex = exQueue[exIdx];
    const txt = exSpeech(ex);
    const fb = document.getElementById('feedbackMsg');
    const mic = document.getElementById('spMic');
    if (mic) mic.disabled = true;
    if (!synth || !txt || !fb) return;
    const row = document.createElement('div');
    row.className = 'sp-row';
    row.innerHTML = '<button class="sp-btn" type="button">🔊 ASCOLTA</button><button class="sp-btn" type="button">🐢 LENTO</button>';
    const [b1, b2] = row.querySelectorAll('button');
    b1.onclick = () => speakText(txt, false);
    b2.onclick = () => speakText(txt, true);
    fb.insertAdjacentElement('afterend', row);
    if (auto) speakText(txt, false);
  };

  const _next = nextExercise;
  nextExercise = function () { if (synth) synth.cancel(); return _next.apply(this, arguments); };
  const _goMap = goMap;
  goMap = function () { if (synth) synth.cancel(); if (recBusy && rec) { try { rec.stop(); } catch (e) {} } return _goMap.apply(this, arguments); };

  // ─── 2. Pannello PRONUNCIA sulla mappa ────────────────────────────────
  function wordsOf(lv) {
    const seen = new Set(), out = [];
    (lv.exercises || []).forEach(e => {
      if (e.type !== 'lv1' || !e.en) return;
      const k = key(e.en);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ en: e.en, it: e.it || '', accept: e.accept || [e.en] });
    });
    return out;
  }
  const studyLevels = LEVELS.filter(l => l.type === 'study' && wordsOf(l).length);
  if (!studyLevels.length || !synth) return;

  const list = document.getElementById('sectionsList');
  if (list) {
    const panel = document.createElement('div');
    panel.className = 'sp-panel';
    panel.innerHTML = '<div class="sp-panel-title">🗣️ PRONUNCIA</div>'
      + '<div class="sp-panel-sub"><b>Ascolta e ripeti</b>: senti la parola e la ripeti. <b>Dillo tu</b>: vedi l\'italiano e dici la parola in inglese. Nessun voto, è allenamento.</div>';
    studyLevels.forEach(lv => {
      const r = document.createElement('div');
      r.className = 'sp-lv';
      r.innerHTML = '<span class="sp-lv-name"></span><button class="sp-btn" type="button">👂 ASCOLTA E RIPETI</button><button class="sp-btn mic" type="button">💬 DILLO TU</button>';
      r.querySelector('.sp-lv-name').textContent = lv.title;
      const [a, b] = r.querySelectorAll('button');
      a.onclick = () => startDrill(lv, 'repeat');
      b.onclick = () => startDrill(lv, 'say');
      panel.appendChild(r);
    });
    list.parentNode.insertBefore(panel, list);
  }

  const scr = document.createElement('div');
  scr.id = 'screen-speak';
  scr.className = 'screen';
  document.body.insertBefore(scr, document.getElementById('screen-results') || null);

  let D = null; // stato del drill

  function startDrill(lv, mode) {
    D = { lv, mode, words: shuffle(wordsOf(lv)), i: 0, tries: 0, done: 0 };
    showScreen('speak');
    window.scrollTo(0, 0);
    drawDrill();
  }

  function drawDrill() {
    const w = D.words[D.i];
    const repeat = D.mode === 'repeat';
    const title = (repeat ? '👂 ASCOLTA E RIPETI · ' : '💬 DILLO TU · ') + D.lv.title;
    scr.innerHTML = '<div class="ex-header"><div class="ex-title"></div><button class="btn-back" type="button" id="spdBack">← MAP</button></div>'
      + '<div class="hud"><div class="hud-track"><div class="hud-fill" style="width:' + (D.i / D.words.length * 100) + '%"></div></div><div class="hud-text">' + (D.i + 1) + '/' + D.words.length + '</div></div>'
      + '<div class="ex-card" id="spdCard">'
      + (repeat
          ? '<div class="sp-word" id="spdWord"></div><div class="sp-it" id="spdIt"></div>'
          : '<div class="sp-big" id="spdIt"></div><div class="sp-word" id="spdWord" style="visibility:hidden"></div>')
      + '<div class="sp-row sp-center">'
      + (SR ? '<button class="sp-btn mic" type="button" id="spdMic">🎤 ' + (repeat ? 'RIPETI' : 'DILLO') + '</button>' : '')
      + '<button class="sp-btn" type="button" id="spdPlay">🔊 ASCOLTA</button>'
      + '<button class="sp-btn" type="button" id="spdSlow">🐢 LENTO</button>'
      + (!repeat ? '<button class="sp-btn" type="button" id="spdShow">👁 MOSTRA</button>' : '')
      + '</div>'
      + '<div class="sp-fb" id="spdFb"></div>'
      + '<div class="sp-row sp-center"><button class="btn btn-secondary" type="button" id="spdNext">AVANTI →</button></div>'
      + '</div>'
      + (SR ? '<div class="sp-note">Il riconoscimento vocale del browser controlla che la parola si capisca, non ogni suono: ascolta bene il modello e imitalo.</div>'
            : '<div class="sp-note">Su questo browser il microfono non è disponibile (usa Chrome o Edge): puoi comunque ascoltare e ripetere ad alta voce.</div>');
    scr.querySelector('.ex-title').textContent = title;
    scr.querySelector('#spdWord').textContent = w.en;
    scr.querySelector('#spdIt').textContent = '🇮🇹 ' + w.it;
    const fb = scr.querySelector('#spdFb');
    const reveal = () => { const el = scr.querySelector('#spdWord'); if (el) el.style.visibility = 'visible'; };

    scr.querySelector('#spdBack').onclick = () => { if (synth) synth.cancel(); goMap(); };
    scr.querySelector('#spdPlay').onclick = () => { if (!repeat) reveal(); speakText(w.en, false); };
    scr.querySelector('#spdSlow').onclick = () => { if (!repeat) reveal(); speakText(w.en, true); };
    const show = scr.querySelector('#spdShow');
    if (show) show.onclick = () => { reveal(); speakText(w.en, false); };
    scr.querySelector('#spdNext').onclick = nextWord;

    const mic = scr.querySelector('#spdMic');
    if (mic) mic.onclick = () => listen(alts => {
      const ok = findMatch(alts, w.accept);
      if (ok) {
        fb.className = 'sp-fb ok';
        fb.textContent = '✓ Perfetto!';
        reveal();
        const card = scr.querySelector('#spdCard');
        if (typeof burstAt === 'function') burstAt(card, '#00ff88');
        if (!repeat) setTimeout(() => speakText(w.en, false), 350);
        D.done++;
        setTimeout(() => { if (D && D.words[D.i] === w) nextWord(); }, repeat ? 1300 : 2300);
      } else {
        D.tries++;
        fb.className = 'sp-fb err';
        if (D.tries >= 3) {
          fb.textContent = 'Ho capito «' + (alts[0] || '') + '». Ascolta ancora una volta e poi vai avanti.';
          reveal();
          speakText(w.en, true);
        } else {
          fb.textContent = 'Ho capito «' + (alts[0] || '') + '». ' + (repeat ? 'Riascolta e riprova.' : 'Riprova, oppure premi 🔊.');
        }
      }
    }, s => {
      mic.classList.toggle('on', s === 'listening');
      if (s !== 'idle') { fb.className = 'sp-fb'; fb.textContent = STATE_MSG[s] || ''; }
    });

    if (repeat) setTimeout(() => speakText(w.en, false), 250);
  }

  function nextWord() {
    if (synth) synth.cancel();
    D.i++; D.tries = 0;
    if (D.i < D.words.length) { drawDrill(); return; }
    const n = D.words.length;
    scr.innerHTML = '<div class="results-card"><div class="res-pct pass">🗣️</div>'
      + '<div class="res-label pass">ALLENAMENTO FINITO!</div>'
      + '<div class="res-threshold">' + (SR ? 'riconosciute al microfono: ' + D.done + ' / ' + n : n + ' parole ascoltate') + '</div>'
      + '<div class="action-bar" style="justify-content:center;margin-top:24px">'
      + '<button class="btn btn-primary" type="button" id="spdAgain">↺ ANCORA</button>'
      + '<button class="btn btn-green" type="button" id="spdMap">← MAPPA</button></div></div>';
    const lv = D.lv, mode = D.mode;
    scr.querySelector('#spdAgain').onclick = () => startDrill(lv, mode);
    scr.querySelector('#spdMap').onclick = () => goMap();
  }
})();
