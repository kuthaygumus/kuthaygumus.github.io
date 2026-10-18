/*
 * Truce partner invite — client-side day counter (2.0.1 #9).
 *
 * The app shares https://kuthaygumus.github.io/truce/together/#d=YYYY-MM-DD[&one=1]. The date lives in
 * the URL FRAGMENT, which the browser never sends to GitHub Pages; this script reads it IN THE BROWSER
 * and counts the days. It never phones home (CSP connect-src 'none').
 *
 * The count mirrors the app's TogetherCounter.day: whole local calendar days from the start day to
 * today, +1 when `one=1` (the Day-1 convention). A missing, malformed or future date degrades to the
 * generic invite — never NaN, never a crash.
 */
(function () {
  "use strict";

  var APP_STORE_URL = "https://apps.apple.com/app/id6780033643";

  // The app's 10 locales (es-ES shares es, pt-BR is pt). `unit` is [one, other] — Intl.PluralRules picks.
  var T = {
    en: { unit: ["day together", "days together"], since: function (d) { return "since " + d; },
          line: "Your partner counts your days together in Truce. Join them 🐦",
          generic: "Your partner invited you to Truce: count your days together 🐦",
          fine: "Truce: a funny counter of your days without a fight. This page counts in your browser — the date never leaves it." },
    tr: { unit: ["gündür birlikte", "gündür birlikte"], since: function (d) { return "Başlangıç: " + d; },
          line: "Partnerin birlikte geçen günlerinizi Truce'ta sayıyor. Sen de katıl 🐦",
          generic: "Partnerin seni Truce'a davet etti: birlikte geçen günlerinizi beraber sayın 🐦",
          fine: "Truce: tartışmasız geçen günlerin komik sayacı. Bu sayfa tarayıcında sayar — tarih hiçbir yere gönderilmez." },
    de: { unit: ["Tag zusammen", "Tage zusammen"], since: function (d) { return "seit " + d; },
          line: "Dein Schatz zählt eure gemeinsamen Tage mit Truce. Zähl mit 🐦",
          generic: "Dein Schatz hat dich zu Truce eingeladen: Zählt eure gemeinsamen Tage 🐦",
          fine: "Truce: der lustige Zähler eurer streitfreien Tage. Diese Seite zählt in deinem Browser – das Datum verlässt ihn nie." },
    es: { unit: ["día juntos", "días juntos"], since: function (d) { return "desde el " + d; },
          line: "Tu pareja está contando sus días juntos con Truce. ¡Únete! 🐦",
          generic: "Tu pareja te invitó a Truce: cuenten sus días juntos 🐦",
          fine: "Truce: el contador divertido de los días sin pelear. Esta página cuenta en tu navegador: la fecha nunca sale de él." },
    fr: { unit: ["jour ensemble", "jours ensemble"], since: function (d) { return "depuis le " + d; },
          line: "Ton/ta partenaire compte vos jours ensemble avec Truce. À toi de jouer 🐦",
          generic: "Ton/ta partenaire t'invite sur Truce : comptez vos jours ensemble 🐦",
          fine: "Truce : le compteur rigolo des jours sans dispute. Cette page compte dans ton navigateur — la date n'en sort jamais." },
    it: { unit: ["giorno insieme", "giorni insieme"], since: function (d) { return "dal " + d; },
          line: "Il tuo partner conta i vostri giorni insieme con Truce. Unisciti 🐦",
          generic: "Il tuo partner ti ha invitato su Truce: contate i vostri giorni insieme 🐦",
          fine: "Truce: il contatore buffo dei giorni senza litigi. Questa pagina conta nel tuo browser: la data non esce mai da lì." },
    ko: { unit: ["일째 함께", "일째 함께"], since: function (d) { return d + "부터"; },
          line: "애인이 Truce로 함께한 날을 세고 있어요. 같이 세어 봐요 🐦",
          generic: "애인이 Truce에 초대했어요. 함께한 날을 같이 세어 봐요 🐦",
          fine: "Truce: 안 싸운 날을 세는 웃긴 카운터. 이 페이지는 브라우저 안에서만 계산해요 — 날짜는 어디에도 전송되지 않아요." },
    nl: { unit: ["dag samen", "dagen samen"], since: function (d) { return "sinds " + d; },
          line: "Je partner telt jullie dagen samen met Truce. Doe mee 🐦",
          generic: "Je partner nodigt je uit voor Truce: tel samen jullie dagen 🐦",
          fine: "Truce: de grappige teller van je dagen zonder ruzie. Deze pagina telt in je browser — de datum verlaat hem nooit." },
    pt: { unit: ["dia juntos", "dias juntos"], since: function (d) { return "desde " + d; },
          line: "Seu parceiro está contando os dias de vocês juntos com o Truce. Conte junto 🐦",
          generic: "Seu parceiro te convidou para o Truce: contem juntos os dias de vocês 🐦",
          fine: "Truce: o contador divertido dos dias sem briga. Esta página conta no seu navegador — a data nunca sai dele." }
  };

  var LANG = (navigator.language || "en").toLowerCase();
  var L = T[LANG.split("-")[0]] ? LANG.split("-")[0] : "en";
  var S = T[L];

  /** The start day from `#d=YYYY-MM-DD` as a local midnight, or null (malformed, impossible, future). */
  function startDay(raw, today) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw || "");
    if (!m) return null;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var date = new Date(y, mo - 1, d);
    // Rejects 2024-02-31 & co: the Date constructor rolls them over into another day.
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return date > today ? null : date;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text; // textContent only — no fragment value is ever innerHTML'd
    return n;
  }

  function badge() {
    var a = el("a", "together-badge");
    a.setAttribute("href", APP_STORE_URL);
    var img = el("img");
    img.setAttribute("src", "/assets/app-store-badge.svg");
    img.setAttribute("alt", "Download on the App Store");
    img.setAttribute("width", "120");
    img.setAttribute("height", "40");
    a.appendChild(img);
    return a;
  }

  function run() {
    var root = document.getElementById("together");
    if (!root) return;
    root.innerHTML = ""; // clear the <noscript> fallback now that JS is running
    document.documentElement.setAttribute("lang", L);

    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    var start = startDay(params.get("d"), today);

    root.appendChild(el("h1", null, "Truce"));
    if (start) {
      // Math.round absorbs the 23/25-hour days around a DST switch.
      var days = Math.round((today - start) / 86400000) + (params.get("one") === "1" ? 1 : 0);
      var card = el("div", "together-card");
      card.appendChild(el("div", "together-day", days.toLocaleString(LANG)));
      var plural = new Intl.PluralRules(LANG).select(days) === "one" ? 0 : 1;
      card.appendChild(el("div", "together-unit", S.unit[plural]));
      var since = new Intl.DateTimeFormat(LANG, { dateStyle: "long" }).format(start);
      card.appendChild(el("div", "together-since", S.since(since)));
      root.appendChild(card);
      root.appendChild(el("p", "together-line", S.line));
    } else {
      root.appendChild(el("p", "together-line", S.generic));
    }
    root.appendChild(badge());
    root.appendChild(el("p", "together-fine", S.fine));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
