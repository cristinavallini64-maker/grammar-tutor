/* ═══════════════════════════════════════════════════════════════════════
   speech-lessico.js — parlato per i file lessico-uN.html (Grammar Quest)
   Si include con UNA riga subito prima di </body>, DOPO lo script del motore:
   <script src="https://cristinavallini64-maker.github.io/grammar-tutor/speech-lessico.js"></script>

   Cosa aggiunge (senza toccare dati, punteggi, tracking, save code):
   negli esercizi lo studente sceglie se scrivere o rispondere a voce (🎤:
   il testo riconosciuto va nella casella); dopo CONTROLLA si sente la parola
   corretta, con il pulsante 🔊 per riascoltarla.
   Usa solo le funzioni del browser (sintesi e riconoscimento vocale): gratis.
   Il riconoscimento funziona su Chrome / Edge (anche Android); se manca,
   i pulsanti 🎤 spariscono e si scrive come sempre.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof LEVELS === 'undefined' || typeof renderExercise !== 'function') return;

  // ─── Sintesi vocale ────────────────────────────────────────────────────
  const synth = window.speechSynthesis || null;
  let voice = null, voiceFailed = false;
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices().filter(v => /^en/i.test(v.lang));
    // prima le voci installate sul dispositivo (le voci online di Chrome a volte tacciono)
    const score = v => (/^en[-_]GB/i.test(v.lang) ? 4 : 0) + (v.localService ? 2 : 0) + (/natural|neural|daniel|serena|kate|libby|sonia|ryan/i.test(v.name) ? 1 : 0);
    voice = vs.sort((x, y) => score(y) - score(x))[0] || null;
  }
  if (synth) { pickVoice(); if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice); else synth.onvoiceschanged = pickVoice; }

  let audioMsg = null; // dove mostrare un eventuale problema audio
  const keep = [];     // Chrome: tenere un riferimento, altrimenti a volte non parla
  // pulizia per la lettura: (opzioni/tra/barre) e (___) via, a / b → a, b
  function clean(t) {
    return String(t)
      .replace(/\s*\((?:[^()]*\/[^()]*|_+)\)\s*/g, ' ')
      .replace(/\s*\/\s*/g, ', ')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function speakText(t, slow, retry) {
    if (!synth || !t) return;
    t = clean(t);
    if (!voice) pickVoice();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'en-GB';
    if (voice && !voiceFailed) { u.voice = voice; u.lang = voice.lang; }
    u.rate = slow ? 0.65 : 0.95;
    let started = false;
    u.onstart = () => { started = true; };
    u.onerror = ev => {
      if (ev.error === 'canceled' || ev.error === 'interrupted') return;
      if (!retry) { voiceFailed = true; speakText(t, slow, true); return; }
      if (audioMsg) audioMsg('⚠ L\'audio non parte (' + ev.error + '): controlla il volume o prova con Chrome / Edge');
    };
    keep.push(u); if (keep.length > 5) keep.shift();
    // Chrome perde la frase se speak() arriva subito dopo cancel(): piccola attesa
    setTimeout(() => {
      if (synth.paused) synth.resume();
      synth.speak(u);
      setTimeout(() => {
        if (started || synth.speaking) return;
        if (!retry) { voiceFailed = true; speakText(t, slow, true); }
        else if (audioMsg) audioMsg(synth.getVoices().some(v => /^en/i.test(v.lang))
          ? '⚠ L\'audio non parte: controlla il volume del dispositivo'
          : '⚠ Su questo dispositivo non c\'è una voce inglese installata: prova con Chrome o Edge');
      }, 1500);
    }, 80);
  }

  // ─── Riconoscimento vocale ─────────────────────────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let rec = null, recBusy = false, lastErr = '';

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
      lastErr = ev.error || '';
      onState(ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'denied'
            : ev.error === 'no-speech' ? 'nospeech'
            : ev.error === 'audio-capture' ? 'nomic'
            : ev.error === 'network' ? 'network' : 'error');
    };
    rec.onend = () => { recBusy = false; onState(got ? 'idle' : 'nospeech'); };
    try { rec.start(); } catch (e) { recBusy = false; onState('error'); }
  }

  const STATE_MSG = {
    listening: '🎤 Ti ascolto… parla ora',
    denied: '⚠ Il microfono è bloccato: consenti l\'uso del microfono al browser',
    nospeech: 'Non ho sentito niente: premi 🎤 e riprova',
    nomic: '⚠ Non trovo un microfono collegato o acceso',
    network: '⚠ Il riconoscimento vocale ha bisogno di internet: controlla la connessione',
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
        if (s !== 'idle') st.textContent = (STATE_MSG[s] || '') + (s === 'error' && lastErr ? ' (' + lastErr + ')' : '');
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
    row.innerHTML = '<button class="sp-btn" type="button">🔊 ASCOLTA</button><span class="sp-status"></span>';
    const b1 = row.querySelector('button'), st = row.querySelector('.sp-status');
    b1.onclick = () => speakText(txt, false);
    audioMsg = m => { st.textContent = m; };
    fb.insertAdjacentElement('afterend', row);
    if (auto) speakText(txt, false);
  };

  const _next = nextExercise;
  nextExercise = function () { if (synth) synth.cancel(); return _next.apply(this, arguments); };
  const _goMap = goMap;
  goMap = function () { if (synth) synth.cancel(); if (recBusy && rec) { try { rec.stop(); } catch (e) {} } return _goMap.apply(this, arguments); };

})();
