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
    if (!email) { if (type !== "time" && type !== "activity") early.push(payload); return; }
    send(payload, type === "time" || type === "activity");
  }

  setInterval(retryQ, 60000);
  window.addEventListener("online", retryQ);

  /* ---- tempo attivo + interazioni ---- */
  var activeSeconds = 0, clicks = 0, lastTick = Date.now(), visible = !document.hidden;

  setInterval(function () {
    var now = Date.now();
    if (visible) activeSeconds += Math.round((now - lastTick) / 1000);
    lastTick = now;
  }, 1000);

  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    lastTick = Date.now();
    if (document.hidden) flush();
  });

  document.addEventListener("click", function (e) {
    if (e.target && (e.target.closest("button") || e.target.closest("a") || e.target.closest("[onclick]"))) {
      clicks++;
    }
  }, true);

  function flush() {
    if (activeSeconds > 0) { post("time", activeSeconds); activeSeconds = 0; }
    if (clicks > 0)        { post("activity", clicks);    clicks = 0; }
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
          early.forEach(function (p) { p.email = email; send(p, false); }); early = [];
          retryQ();
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
