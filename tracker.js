/* =====================================================================
   The English Framework — Access Tracker
   Da includere in OGNI pagina con:
   <script src="https://cristinavallini64-maker.github.io/grammar-tutor/tracker.js"></script>
   (metti tracker.js nel repo grammar-tutor, oppure cambia il percorso)
   ===================================================================== */
(function () {
  "use strict";

  /* ===== CONFIG — COMPILA QUESTI 3 VALORI ===== */
  var CONFIG = {
    SCHOOL_DOMAIN:    "iisprimolevi.org",
    GOOGLE_CLIENT_ID: "634797265478-onbutlhkvgga133qf1n6imb8a1difce0.apps.googleusercontent.com",
    WORKER_URL:       "https://tracker.cristinavallini64.workers.dev"
  };
  /* ============================================ */

  var EMAIL_KEY = "ef_student_email";
  var email = null;
  try { email = localStorage.getItem(EMAIL_KEY); } catch (e) {}

  function pageName() {
    return (location.pathname.split("/").pop() || location.pathname);
  }

  function post(type, num) {
    if (!email) return;
    var body = JSON.stringify({
      email: email,
      type:  type,
      page:  pageName(),
      title: document.title,
      num:   (typeof num === "number" ? num : null)
    });
    try {
      if (navigator.sendBeacon && (type === "time" || type === "activity")) {
        navigator.sendBeacon(CONFIG.WORKER_URL + "/log", new Blob([body], { type: "application/json" }));
      } else {
        fetch(CONFIG.WORKER_URL + "/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true
        });
      }
    } catch (e) {}
  }

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
        auto_select: true,
        hd:          CONFIG.SCHOOL_DOMAIN
      });
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
          try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}
          var ov = document.getElementById("ef-login-overlay");
          if (ov) ov.remove();
          startSession();
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

  if (email) {
    startSession();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showLogin);
  } else {
    showLogin();
  }
})();
