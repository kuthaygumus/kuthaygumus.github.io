/*
 * Truce Code duel — client-side payload renderer (§2.3 of the master plan).
 *
 * The URL is the message bus; there is NO backend. This script reads the `d` query param,
 * base64url-decodes a tiny JSON payload IN THE BROWSER, and renders a human-readable
 * comparison for a friend who opened the link. It never phones home (CSP connect-src 'none').
 *
 * The HMAC `&s=<sig>` is intentionally NOT verified here — the key is app-only. Web rendering is
 * cosmetic; the signature only matters when the *app* opens the link. If a payload is missing,
 * malformed, or a newer version, we degrade gracefully to the generic challenge — never a crash.
 *
 * Payload shape (must match the app encoder — canonical enum orders are app-side too):
 *   base64url(JSON{ v:1, d:currentDay, r:recordDays, t:totalResets, rsn:reasonIndex, mt:moltIndex })
 */
(function () {
  "use strict";

  var PAYLOAD_VERSION = 1;

  // The real App Store product (com.kgumus.truce → 6780033643). SINGLE LAUNCH FLAG: while LAUNCHED is
  // false the duel CTA points at the landing page (whose Smart App Banner handles iOS install once the
  // app is live) because the apps.apple.com URL 404s before publication. Flip to true at App Store launch.
  var LAUNCHED = false;
  var APP_STORE_URL = "https://apps.apple.com/app/id6780033643";

  // Canonical ReasonCode order (index === app enum rawValue: dishes=0 … other=7).
  var REASONS = {
    tr: ["Bulaşık", "Kıskançlık", "Telefon", "Klima savaşı", "Para", "Kayınlar", "Sebepsiz", "Diğer"],
    en: ["Dishes", "Jealousy", "Phone", "Thermostat war", "Money", "In-laws", "No reason", "Other"]
  };
  // Canonical MoltTier order (index === app enum rawValue: hatchling=0 … legendary=5).
  var MOLT = ["Hatchling", "Fledgling", "Streetwise", "Veteran", "Sage", "Legendary"];

  var L = (navigator.language || "en").toLowerCase().indexOf("tr") === 0 ? "tr" : "en";

  var T = {
    tr: {
      dayLabel: ". gün",
      record: "Rekor",
      resets: "Sıfırlanma",
      reason: "Baş suçlu",
      tier: "Bicky",
      challenge: function (d) { return "Arkadaşın " + d + ". günde. Sen kaçıncı gündesin? 🫠"; },
      cta: "Truce'u indir, cevap ver →",
      stale: "Karşılaştırmak için Truce'u güncelle.",
      generic: "Bir arkadaşın seni Truce düellosuna çağırdı. Sen kaçıncı gündesin?",
      fine: "Truce: tartışmasız geçen günlerin komik sayacı. Abonelik yok. On-device."
    },
    en: {
      dayLabel: "Day ",
      record: "Record",
      resets: "Resets",
      reason: "Prime suspect",
      tier: "Bicky",
      challenge: function (d) { return "Your friend is on Day " + d + ". What day are YOU on? 🫠"; },
      cta: "Get Truce to answer →",
      stale: "Update Truce to compare.",
      generic: "A friend challenged you to a Truce duel. What day are YOU on?",
      fine: "Truce: a funny counter for the days since you last argued. No subscription. On-device."
    }
  }[L];

  function intIn(value, min, max) {
    var n = Number(value);
    if (!isFinite(n)) return null;
    n = Math.floor(n);
    if (n < min || n > max) return null;
    return n;
  }

  function decodePayload(raw) {
    if (!raw) return null;
    try {
      var b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4 !== 0) b64 += "=";
      var json = JSON.parse(atob(b64));
      if (Number(json.v) !== PAYLOAD_VERSION) return { stale: true };
      return {
        d: intIn(json.d, 0, 100000),
        r: intIn(json.r, 0, 100000),
        t: intIn(json.t, 0, 100000),
        rsn: intIn(json.rsn, 0, REASONS.en.length - 1),
        mt: intIn(json.mt, 0, MOLT.length - 1)
      };
    } catch (e) {
      return null;
    }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text; // textContent only — no payload value is ever innerHTML'd
    return n;
  }

  function ctaButton() {
    var a = el("a", "duel-cta", T.cta);
    // Pre-launch the apps.apple.com URL 404s, so fall back to the landing page (whose Smart App Banner
    // carries the real app-id and handles iOS install). Flip LAUNCHED at App Store launch — one edit.
    a.setAttribute("href", LAUNCHED ? APP_STORE_URL : "/truce/");
    return a;
  }

  function renderGeneric(root, message) {
    root.appendChild(el("h1", null, L === "tr" ? "Sen kaçıncı gündesin?" : "What day are YOU on?"));
    root.appendChild(el("p", "duel-line", message || T.generic));
    root.appendChild(ctaButton());
    root.appendChild(el("p", "duel-fine", T.fine));
  }

  function renderDuel(root, p) {
    var card = el("div", "duel-card");
    var day = el("div", "duel-day");
    day.appendChild(document.createTextNode(L === "tr" ? String(p.d) : T.dayLabel + String(p.d)));
    if (L === "tr") {
      var unit = el("span", "duel-label", T.dayLabel);
      unit.style.fontSize = "0.4em";
      day.appendChild(unit);
    }
    card.appendChild(day);

    var stats = el("div", "duel-stats");
    if (p.r != null) stats.appendChild(el("span", null, T.record + ": " + p.r));
    if (p.t != null) stats.appendChild(el("span", null, T.resets + ": " + p.t));
    if (p.rsn != null) stats.appendChild(el("span", null, T.reason + ": " + REASONS[L][p.rsn]));
    if (p.mt != null) stats.appendChild(el("span", null, T.tier + ": " + MOLT[p.mt] + " 🕊️"));
    card.appendChild(stats);
    root.appendChild(card);

    root.appendChild(el("p", "duel-line", T.challenge(p.d == null ? "?" : p.d)));
    root.appendChild(ctaButton());
    root.appendChild(el("p", "duel-fine", T.fine));
  }

  function run() {
    var root = document.getElementById("duel");
    if (!root) return;
    root.innerHTML = ""; // clear the <noscript> fallback now that JS is running

    var params = new URLSearchParams(window.location.search);
    var decoded = decodePayload(params.get("d"));

    if (decoded && decoded.stale) {
      renderGeneric(root, T.stale);
    } else if (decoded && decoded.d != null) {
      renderDuel(root, decoded);
    } else {
      renderGeneric(root, null);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
