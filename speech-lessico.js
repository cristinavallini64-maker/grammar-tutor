/* ═══════════════════════════════════════════════════════════════════════
   speech-lessico.js — parlato per i file lessico-uN.html (Grammar Quest)
   Si include con UNA riga subito prima di </body>, DOPO lo script del motore:
   <script src="https://cristinavallini64-maker.github.io/grammar-tutor/speech-lessico.js"></script>

   Cosa aggiunge (senza toccare dati, punteggi, tracking, save code):
   negli esercizi il sito legge la domanda (🔊, voce italiana per l'italiano,
   inglese per l'inglese, una pausa al posto del buco); lo studente sceglie se
   scrivere o rispondere a voce (🎤: il testo riconosciuto va nella casella);
   dopo CONTROLLA si sente la parola corretta. AUDIO ON = lettura automatica.
   Usa solo le funzioni del browser (sintesi e riconoscimento vocale): gratis.
   Il riconoscimento funziona su Chrome / Edge (anche Android); se manca,
   i pulsanti 🎤 spariscono e si scrive come sempre.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof LEVELS === 'undefined' || typeof renderExercise !== 'function') return;

  // ─── Sintesi vocale (inglese e italiano) ──────────────────────────────
  // Stesso metodo del pulsante Ascolta della pagina Studia, che funziona anche
  // sui Chromebook: si parla SUBITO, dentro il clic (niente attese), e si
  // sceglie la prima voce en-GB / en-US / en (o it-IT / it).
  const synth = window.speechSynthesis || null;
  function scegliVoce(l) {
    const vs = synth ? synth.getVoices() : [];
    const pref = l === 'en' ? ['en-gb', 'en-us', 'en'] : ['it-it', 'it'];
    for (const p of pref) {
      const v = vs.find(x => x.lang && x.lang.replace('_', '-').toLowerCase().startsWith(p));
      if (v) return v;
    }
    return null;
  }
  function senzaInglese() {
    const vs = synth ? synth.getVoices() : [];
    return vs.length > 0 && !vs.some(x => x.lang && x.lang.toLowerCase().startsWith('en'));
  }
  if (synth && synth.onvoiceschanged !== undefined) synth.onvoiceschanged = () => {};

  let audioMsg = null;   // dove mostrare un eventuale problema audio
  const keep = [];       // Chrome: tenere un riferimento alle frasi in coda

  // segs: [{t:'testo', lang:'en'|'it'}]
  function play(segs) {
    if (!synth) return;
    synth.cancel();
    segs = segs.filter(x => x.t && x.t.trim());
    if (senzaInglese()) {
      segs = segs.filter(x => x.lang !== 'en');
      if (audioMsg) audioMsg('⚠ Su questo dispositivo non c\'è una voce inglese: le parti in inglese non vengono lette');
    }
    if (!segs.length) return;
    keep.length = 0;
    segs.forEach((sg, i) => {
      const u = new SpeechSynthesisUtterance(sg.t);
      u.lang = sg.lang === 'en' ? 'en-GB' : 'it-IT';
      const v = scegliVoce(sg.lang);
      if (v) u.voice = v;
      u.rate = sg.lang === 'en' ? 0.85 : 0.95;
      if (i === segs.length - 1) u.onerror = ev => {
        if (ev.error === 'canceled' || ev.error === 'interrupted') return;
        if (audioMsg) audioMsg('⚠ L\'audio non parte (' + ev.error + ')');
      };
      keep.push(u);
      synth.speak(u);
    });
  }
  function stopAudio() { if (synth) synth.cancel(); }

  // pulizia: a / b → a, b ; trattini lunghi → pausa
  function tidy(t) {
    return String(t).replace(/\s*[\/·]\s*/g, ', ').replace(/\s+[—–]\s+/g, ', ').replace(/\s+/g, ' ').trim();
  }
  function speakText(t) { play([{ t: tidy(String(t).replace(/_+/g, ' ')), lang: 'en' }]); }

  // italiano o inglese? (per le note tra parentesi e le opzioni)
  const IT_WORDS = /\b(di|da|la|il|lo|le|gli|un|una|uno|con|per|non|che|su|al|del|della|nel|vicino|cosa|persona|domanda|offerta|dietro|davanti|soggetto|oggetto|troppo|promessa|deciso|evidenza|visiva|previsione|intenzione|obbligatorio|sempre|mai|discordo|frase|negativa|positiva|anche|quando|dove|parola|verbo|aggettivo|nome|plurale|singolare|scrivi|inglese|italiano)\b/i;
  function looksItalian(t) { return /[àèéìòù]/i.test(t) || IT_WORDS.test(t) || /\b[a-z]+(zione|mente)\b/i.test(t); }

  // spezza un testo in pezzi: "virgolette" = altra lingua; (parentesi) = italiano nelle domande italiane, lingua riconosciuta nelle frasi inglesi; ___ = pausa
  function segment(text, base) {
    const other = base === 'it' ? 'en' : 'it';
    const out = [];
    const pushText = (t, lang) => {
      const c = tidy(String(t).replace(/_{2,}/g, ' … '));
      if (c && /[\p{L}\p{N}]/u.test(c)) out.push({ t: c, lang });
    };
    const re = /"([^"]*)"|\(([^()]*)\)/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      pushText(text.slice(last, m.index), base);
      if (m[1] !== undefined) pushText(m[1], other);
      else pushText(m[2], base === 'it' ? 'it' : (looksItalian(m[2]) ? 'it' : 'en'));
      last = re.lastIndex;
    }
    pushText(text.slice(last), base);
    return out;
  }

  // la domanda dell'esercizio, da leggere ad alta voce
  function questionSegs(ex) {
    if (!ex) return [];
    const q = String(ex.q || '').replace(/^[^\p{L}\p{N}_"'(]+/u, '');
    if (ex._lv === 3) {
      const segs = segment(q, 'en');
      const h = String(ex.hint || '').replace(/^\(|\)$/g, '');
      if (h && h !== 'scrivi in inglese') segs.push(...segment('(' + h + ')', looksItalian(h) ? 'it' : 'en'));
      return segs;
    }
    return segment(q, 'it');   // LV1 (italiano) e LV2 (definizione in italiano)
  }

  // ─── Riconoscimento vocale ─────────────────────────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let rec = null, recBusy = false, lastErr = '';

  function listen(onResult, onState) {
    if (!SR) return;
    if (recBusy && rec) { try { rec.stop(); } catch (e) {} return; }
    stopAudio();
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
    t.title = 'Lettura automatica: la domanda quando compare e la risposta corretta dopo CONTROLLA';
    t.onclick = () => { auto = !auto; try { localStorage.setItem(AK, auto ? '1' : '0'); } catch (e) {} paint(); if (!auto) stopAudio(); };
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
    if (!ex || !inp) return;
    // 🔊 lettura della domanda (per chi fa fatica a leggere)
    if (synth) {
      const segs = questionSegs(ex);
      const qrow = document.createElement('div');
      qrow.className = 'sp-row';
      qrow.style.margin = '0 0 10px';
      qrow.innerHTML = '<button class="sp-btn" type="button" id="spQ">🔊 LEGGI LA DOMANDA</button><span class="sp-status" id="spQst"></span>';
      inp.insertAdjacentElement('beforebegin', qrow);
      const qst = qrow.querySelector('#spQst');
      audioMsg = m => { qst.textContent = m; };
      qrow.querySelector('#spQ').onclick = () => { audioMsg = m => { qst.textContent = m; }; play(segs); };
      if (auto) play(segs);
    }
    if (!SR) return;
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
    b1.onclick = () => { audioMsg = m => { st.textContent = m; }; speakText(txt); };
    audioMsg = m => { st.textContent = m; };
    fb.insertAdjacentElement('afterend', row);
    if (auto) speakText(txt);
  };

  const _next = nextExercise;
  nextExercise = function () { stopAudio(); return _next.apply(this, arguments); };
  const _goMap = goMap;
  goMap = function () { stopAudio(); if (recBusy && rec) { try { rec.stop(); } catch (e) {} } return _goMap.apply(this, arguments); };

})();
