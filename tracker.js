/* =====================================================================
   The English Framework — Access Tracker
   Da includere in OGNI pagina con:
   <script src="https://cristinavallini64-maker.github.io/grammar-tutor/tracker.js"></script>
   (metti tracker.js nel repo grammar-tutor, oppure cambia il percorso)
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     INTERRUTTORE GENERALE
     ---------------------------------------------------------------------
     false = tracking SPENTO: nessun login, nessuna registrazione.
             Le pagine funzionano normalmente, come se questo file non ci fosse.
     true  = tracking ACCESO.

     Serviva per i recuperi estivi: verificare chi aveva davvero lavorato
     sulla piattaforma. Fuori da quel periodo raccoglierebbe dati inutilizzati
     e costringerebbe a un login in piu' a ogni apertura (PC condivisi).

     Per riaccenderlo la prossima estate: mettere true e ricaricare su GitHub.
     Basta questo file: le pagine non vanno toccate.
     I dati gia' registrati nel database restano dove sono.
     ===================================================================== */
  var ATTIVO = true;

  if (!ATTIVO) {
    // API finta: le pagine che chiamano EFTrack.event(...) non danno errore.
    window.EFTrack = { event: function () {} };
    return;
  }

  /* =====================================================================
     MODALITA' DOCENTE
     Sui dispositivi della docente: un solo login, poi mai piu' richiesto
     e nessuna registrazione (la dashboard resta pulita).
     Si attiva dopo il login con l'account della docente, rispondendo "Si'"
     alla domanda "Ricordare questo dispositivo?". MAI sui PC del laboratorio.
     Per annullare: pulsante "esci" in basso a sinistra.
     L'email non e' scritta in chiaro: qui c'e' solo la sua impronta SHA-256.
     ===================================================================== */
  var DOCENTE_HASH = "e2afcff81f655c84b69168c780300eed342312ce2db6bb1064f519146f901428";
  var DKEY = "ef_docente_v1";
  function isDocente() { try { return localStorage.getItem(DKEY) === "1"; } catch (e) { return false; } }

  if (isDocente()) {
    window.EFTrack = { event: function () {} };
    var addBadge = function () {
      var b = document.createElement("button");
      b.textContent = "👩‍🏫 docente · esci";
      b.title = "Modalita' docente: nessun login e nessuna registrazione su questo dispositivo. Clicca per uscire.";
      b.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;font:12px sans-serif;" +
        "padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.3);" +
        "background:rgba(0,0,0,.55);color:#fff;opacity:.6;cursor:pointer;";
      b.onclick = function () {
        if (!confirm("Uscire dalla modalità docente su questo dispositivo?")) return;
        try { localStorage.removeItem(DKEY); } catch (e) {}
        location.reload();
      };
      document.body.appendChild(b);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addBadge);
    else addBadge();
    return;
  }

  function sha256hex(str) {
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) return Promise.resolve("");
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    }).catch(function () { return ""; });
  }

  function askRemember() {
    var ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(13,13,13,.94);display:flex;" +
      "flex-direction:column;align-items:center;justify-content:center;gap:16px;" +
      "font-family:sans-serif;color:#fff;text-align:center;padding:20px;";
    ov.innerHTML =
      '<div style="font-size:1.25rem;font-weight:800;">Ricordare questo dispositivo?</div>' +
      '<div style="opacity:.8;max-width:380px;">Su questo dispositivo non ti verr&agrave; pi&ugrave; chiesto l\'accesso e la tua attivit&agrave; non verr&agrave; registrata.<br><b>Non farlo sui PC del laboratorio.</b></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">' +
      '<button id="ef-doc-yes" style="font-size:1rem;padding:10px 18px;border-radius:8px;border:0;background:#1a73e8;color:#fff;cursor:pointer;">S&igrave;, &egrave; il mio dispositivo</button>' +
      '<button id="ef-doc-no" style="font-size:1rem;padding:10px 18px;border-radius:8px;border:1px solid #888;background:transparent;color:#fff;cursor:pointer;">No</button></div>';
    document.body.appendChild(ov);
    document.getElementById("ef-doc-yes").onclick = function () {
      try { localStorage.setItem(DKEY, "1"); } catch (e) {}
      location.reload();
    };
    document.getElementById("ef-doc-no").onclick = function () { ov.remove(); };
  }

  /* ===== CONFIG — COMPILA QUESTI 3 VALORI ===== */
  var CONFIG = {
    SCHOOL_DOMAIN:    "iisprimolevi.org",
    GOOGLE_CLIENT_ID: "634797265478-onbutlhkvgga133qf1n6imb8a1difce0.apps.googleusercontent.com",
    WORKER_URL:       "https://tracker.cristinavallini64.workers.dev"
  };
  /* ============================================ */

  // Strada B: nessuna memoria del login. L'account si sceglie a ogni apertura.
  var email = null;

  function pageName() {
    return (location.pathname.split("/").pop() || location.pathname);
  }

  /* Punteggi che non sono partiti (rete assente, login non ancora fatto):
     restano in coda e vengono rimandati appena possibile.
     La coda salvata nel browser vale solo per lo STESSO studente (stessa email). */
  var QKEY = "ef_pending_v1";
  var early = [];                       // eventi nati prima del login (solo in questa pagina)
  function loadQ() { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch (e) { return []; } }
  function saveQ(q) { try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-200))); } catch (e) {} }

  function send(payload, isBeacon) {
    var body = JSON.stringify(payload);
    // text/plain = richiesta "semplice": nessun controllo preliminare CORS, funziona anche su tablet
    if (isBeacon && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(CONFIG.WORKER_URL + "/log", new Blob([body], { type: "text/plain;charset=UTF-8" }))) return; } catch (e) {}
    }
    try {
      fetch(CONFIG.WORKER_URL + "/log", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: body,
        keepalive: true
      }).then(function (r) { return r.json(); })
        .then(function (d) { if (!d || !d.ok) throw 0; })
        .catch(function () { if (!isBeacon) { var q = loadQ(); q.push(payload); saveQ(q); } });
    } catch (e) { if (!isBeacon) { var q = loadQ(); q.push(payload); saveQ(q); } }
  }

  function retryQ() {
    if (!email) return;
    var q = loadQ(), keep = [], mine = [];
    q.forEach(function (p) { (p.email === email ? mine : keep).push(p); });
    saveQ(keep);
    mine.forEach(function (p) { send(p, false); });
  }

  function post(type, num) {
    var payload = {
      email: email,
      type:  type,
      page:  pageName(),
      title: document.title,
      num:   (typeof num === "number" ? num : null)
    };
    var bg = (type === "time" || type === "activity" || type === "uscite" || type === "fuori");
    if (!email) { if (!bg) early.push(payload); return; }
    send(payload, bg);
  }

  setInterval(retryQ, 60000);
  window.addEventListener("online", retryQ);

  /* ---- tempo attivo + interazioni + uscite dalla pagina ----
     "Uscita" = lo studente lascia la pagina degli esercizi per un'altra scheda,
     un'altra finestra o un'altra app (es. per cercare le risposte), e poi torna.
     Si registra quante volte esce e per quanti secondi resta fuori.
     Il tempo attivo conta solo quando lo studente e' sulla pagina. */
  var activeSeconds = 0, clicks = 0, lastTick = Date.now();
  var out = document.hidden || (document.hasFocus && !document.hasFocus());
  var outSince = out ? Date.now() : 0, leaves = 0, awaySeconds = 0;

  setInterval(function () {
    var now = Date.now();
    if (!out) activeSeconds += Math.round((now - lastTick) / 1000);
    lastTick = now;
  }, 1000);

  // Un'assenza piu' lunga di PAUSA non e' un'"uscita" (es. pagina lasciata aperta in background,
  // ricreazione, tablet in standby): non si conta, altrimenti risulterebbero ore "fuori".
  var PAUSA = 10 * 60;   // secondi
  function goOut() {
    if (out) return;
    out = true; outSince = Date.now(); lastTick = Date.now();
  }
  function comeBack() {
    if (!out) return;
    out = false; lastTick = Date.now();
    if (email && outSince) {
      var sec = Math.round((Date.now() - outSince) / 1000);
      if (sec >= 2 && sec <= PAUSA) { leaves++; awaySeconds += sec; }
    }
    outSince = 0;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { goOut(); flush(); } else comeBack();
  });
  window.addEventListener("blur", goOut);
  window.addEventListener("focus", comeBack);

  document.addEventListener("click", function (e) {
    comeBack();
    if (e.target && (e.target.closest("button") || e.target.closest("a") || e.target.closest("[onclick]"))) {
      clicks++;
    }
  }, true);

  function flush() {
    if (activeSeconds > 0) { post("time", activeSeconds); activeSeconds = 0; }
    if (clicks > 0)        { post("activity", clicks);    clicks = 0; }
    if (leaves > 0)        { post("uscite", leaves);      leaves = 0; }
    if (awaySeconds > 0)   { post("fuori", awaySeconds);  awaySeconds = 0; }
  }

  // invio periodico: il tempo arriva anche se il PC viene spento senza chiudere la pagina
  setInterval(function () { if (email) flush(); }, 60000);
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);

  /* ---- API per eventi futuri (es. punteggi esercizi) ---- */
  window.EFTrack = { event: function (name, num) { post(String(name), num); } };

  /* ---- avvio sessione ---- */
  function startSession() { post("open"); }

  /* ---- login con Google ---- */
  function showLogin() {
    var ov = document.createElement("div");
    ov.id = "ef-login-overlay";
    ov.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(13,13,13,.94);display:flex;" +
      "flex-direction:column;align-items:center;justify-content:center;gap:18px;" +
      "font-family:sans-serif;color:#fff;text-align:center;padding:20px;";
    ov.innerHTML =
      '<div style="font-size:1.3rem;font-weight:800;">Accedi con l\'account della scuola</div>' +
      '<div style="opacity:.75;max-width:340px;">Usa la tua email <b>@' + CONFIG.SCHOOL_DOMAIN + '</b> per continuare.</div>' +
      '<div id="ef-gbtn"></div>' +
      '<div id="ef-login-err" style="color:#ff6b6b;font-size:.9rem;min-height:1.2em;"></div>';
    document.body.appendChild(ov);

    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = function () {
      /* global google */
      google.accounts.id.initialize({
        client_id:   CONFIG.GOOGLE_CLIENT_ID,
        callback:    onCredential,
        auto_select: false,
        hd:          CONFIG.SCHOOL_DOMAIN
      });
      try { google.accounts.id.disableAutoSelect(); } catch (e) {}
      google.accounts.id.renderButton(
        document.getElementById("ef-gbtn"),
        { theme: "filled_blue", size: "large", text: "signin_with" }
      );
      google.accounts.id.prompt();
    };
    document.head.appendChild(s);
  }

  function onCredential(resp) {
    fetch(CONFIG.WORKER_URL + "/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: resp.credential })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.email) {
          email = d.email;
          var ov = document.getElementById("ef-login-overlay");
          if (ov) ov.remove();
          startSession();
          leaves = 0; awaySeconds = 0; out = false; outSince = 0; lastTick = Date.now();   // il tempo del login non conta come uscita
          early.forEach(function (p) { p.email = email; send(p, false); }); early = [];
          retryQ();
          sha256hex(String(email).trim().toLowerCase()).then(function (h) { if (h === DOCENTE_HASH) askRemember(); });
        } else {
          var err = document.getElementById("ef-login-err");
          if (err) err.textContent = (d && d.error) || "Accesso non consentito.";
        }
      })
      .catch(function () {
        var err = document.getElementById("ef-login-err");
        if (err) err.textContent = "Errore di rete. Riprova.";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showLogin);
  } else {
    showLogin();
  }
})();
