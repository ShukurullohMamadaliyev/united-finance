// United Finance Security & Protection Layer
(function() {
  'use strict';
  // Disable right-click context menu on page elements
  document.addEventListener('contextmenu', function(e) {
    if (!e.target.closest('input, textarea, select')) {
      e.preventDefault();
    }
  });

  // Prevent developer tool shortcuts & source viewing
  document.addEventListener('keydown', function(e) {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && (e.key === 'u' || e.key === 'U')) ||
      (e.ctrlKey && (e.key === 's' || e.key === 'S')) ||
      (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].indexOf(e.key) !== -1)
    ) {
      e.preventDefault();
      return false;
    }
  });
})();

>
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function groupThousands(str) { return String(str).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

  /* ---------------------------------------------------------
     1. scroll progress + sticky header + back-to-top
     --------------------------------------------------------- */
  var hdr = $("#hdr"), bar = $("#progress"), toTop = $("#toTop");
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
    hdr.classList.toggle("is-stuck", y > 24);
    toTop.classList.toggle("is-on", y > 700);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  });

  /* ---------------------------------------------------------
     2. mobile menu
     --------------------------------------------------------- */
  var burger = $("#burger"), mnav = $("#mobileNav");
  function closeNav() {
    burger.classList.remove("is-open");
    mnav.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  burger.addEventListener("click", function () {
    var open = !mnav.classList.contains("is-open");
    burger.classList.toggle("is-open", open);
    mnav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  });
  $$(".m-link, .mobile-nav .btn").forEach(function (a) { a.addEventListener("click", closeNav); });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") closeNav(); });
  window.addEventListener("resize", function () { if (window.innerWidth > 1080) closeNav(); });

  /* ---------------------------------------------------------
     3. scroll reveal — also arms the ledger bars
     --------------------------------------------------------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-visible");
      var led = en.target.querySelector && en.target.querySelector(".ledger");
      if (led) led.classList.add("is-live");
      io.unobserve(en.target);
    });
  }, { threshold: 0.14, rootMargin: "0px 0px -60px 0px" });
  $$(".rv").forEach(function (el) { io.observe(el); });

  /* ---------------------------------------------------------
     4. animated counters
     --------------------------------------------------------- */
  function runCounter(el) {
    var to = parseFloat(el.getAttribute("data-to")) || 0;
    var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var dur = reduced ? 0 : 1500;
    var t0 = null;

    function paint(v) {
      var s = v.toFixed(dec);
      var p = s.split(".");
      s = groupThousands(p[0]) + (p[1] ? "," + p[1] : "");
      el.textContent = s + suffix;
    }
    /* a hidden tab never runs rAF, so the figure would be stuck at zero —
       in that case skip the count-up and show the real number */
    if (dur === 0 || document.hidden) { paint(to); return; }

    function frame(ts) {
      if (t0 === null) t0 = ts;
      var pr = Math.min((ts - t0) / dur, 1);
      if (pr >= 1) { paint(to); return; }
      paint(to * (1 - Math.pow(1 - pr, 3)));
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  var statsEl = $("#stats");
  if (statsEl) {
    var statsIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        $$(".counter", en.target).forEach(runCounter);
        statsIO.unobserve(en.target);
      });
    }, { threshold: 0.3 });
    statsIO.observe(statsEl);
  }

  /* ---------------------------------------------------------
     5. scrollspy for the desktop nav
     --------------------------------------------------------- */
  var navLinks = $$(".nav a");
  var spyTargets = navLinks.map(function (a) { return $(a.getAttribute("href")); }).filter(Boolean);
  if (spyTargets.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    spyTargets.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------------------------------------------------
     6. price calculator (Mathematical Model & Tariff Matrix)
     Formula: Jami Narx = Baza Narxi + (Xodimlar Bosqichi * Qadam Narxi) + (Hujjatlar Bosqichi * Qadam Narxi)
     --------------------------------------------------------- */
  var turnoverLabels = ["100 mln soʻmgacha", "500 mln soʻmgacha", "1 mlrd soʻmgacha", "5 mlrd soʻmgacha"];
  var employeeLabels = ["1-3 kishi", "4-10 kishi", "11-25 kishi", "26-50 kishi", "50+ kishi"];
  var formLabels = { yatt: "YaTT", mchj: "MChJ / XK", foreign: "Chet el korxonasi" };
  var taxLabels  = { aylanma: "Aylanmadan soliq (1%)", qqs: "QQS / Umumiy rejim", turnover: "Aylanmadan soliq (1%)", vat: "QQS / Umumiy rejim" };
  var docLabels  = { low: "20 tagacha", medium: "20–100 ta", high: "100+ ta" };

  var calcState = { form: "yatt", tax: "aylanma", turn: 1, emp: 0, doc: "low" };
  var priceEl = $("#calcPrice");
  var shownPrice = 600000;

  function computePrice() {
    var isYatt = calcState.form === "yatt";
    var isAylanma = calcState.tax === "aylanma" || calcState.tax === "turnover";

    var basePrice = 0;
    var stepPriceEmp = 0;
    var stepPriceDoc = 0;

    if (isYatt) {
      if (isAylanma) {
        // YaTT (Aylanma 1%)
        var turnoverBase = [600000, 800000, 1000000, 2000000];
        var turnIdx = Math.min(Math.max(calcState.turn - 1, 0), 3);
        basePrice = turnoverBase[turnIdx];
        stepPriceEmp = 100000;
        stepPriceDoc = 100000;
      } else {
        // YaTT (QQS)
        basePrice = 3000000;
        stepPriceEmp = 100000;
        stepPriceDoc = 100000;
      }
    } else {
      // MChJ / XK / Chet el korxonasi
      if (isAylanma) {
        // MChJ (Aylanma 4%)
        var turnoverBase = [1200000, 1800000, 2400000, 3200000];
        var turnIdx = Math.min(Math.max(calcState.turn - 1, 0), 3);
        basePrice = turnoverBase[turnIdx];
        stepPriceEmp = 150000;
        stepPriceDoc = 150000;
      } else {
        // MChJ (QQS / Umumiy rejim)
        basePrice = 3200000;
        stepPriceEmp = 200000;
        stepPriceDoc = 200000;
      }
    }

    var empStep = typeof calcState.emp === "number" ? calcState.emp : 0;
    var docMap = { low: 0, medium: 1, high: 2 };
    var docStep = docMap[calcState.doc] !== undefined ? docMap[calcState.doc] : 0;

    var totalPrice = basePrice + (empStep * stepPriceEmp) + (docStep * stepPriceDoc);
    return totalPrice;
  }

  function animatePrice(from, to) {
    if (reduced || from === to || document.hidden) { priceEl.textContent = groupThousands(to); return; }

    var t0 = null, dur = 420;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var pr = Math.min((ts - t0) / dur, 1);
      if (pr >= 1) { priceEl.textContent = groupThousands(to); return; }
      var v = Math.round((from + (to - from) * (1 - Math.pow(1 - pr, 3))) / 10000) * 10000;
      priceEl.textContent = groupThousands(v);
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function renderCalc() {
    var isMchj = calcState.form === "mchj" || calcState.form === "foreign";
    var aylanmaBtn = $('.opts[data-group="tax"] button[data-val="aylanma"]');
    var aylanmaText = isMchj ? "Aylanmadan soliq (4%)" : "Aylanmadan soliq (1%)";
    if (aylanmaBtn) aylanmaBtn.textContent = aylanmaText;

    var next = computePrice();
    animatePrice(shownPrice, next);
    shownPrice = next;

    var turnIdx = Math.min(Math.max(calcState.turn - 1, 0), turnoverLabels.length - 1);
    var empIdx = Math.min(Math.max(calcState.emp, 0), employeeLabels.length - 1);

    var currentTaxLabel = (calcState.tax === "aylanma" || calcState.tax === "turnover")
      ? aylanmaText
      : (taxLabels[calcState.tax] || "QQS / Umumiy rejim");

    $("#turnoverVal").textContent = turnoverLabels[turnIdx];
    $("#empVal").textContent      = employeeLabels[empIdx];
    $("#sumForm").textContent = formLabels[calcState.form] || "YaTT";
    $("#sumTax").textContent  = currentTaxLabel;
    $("#sumTurn").textContent = turnoverLabels[turnIdx];
    $("#sumEmp").textContent  = employeeLabels[empIdx];
    $("#sumDoc").textContent  = docLabels[calcState.doc] || "20 tagacha";
  }

  if (priceEl) {
    $$(".opts").forEach(function (group) {
      var key = group.getAttribute("data-group");
      $$(".opt", group).forEach(function (btn) {
        btn.addEventListener("click", function () {
          $$(".opt", group).forEach(function (o) { o.classList.remove("is-on"); });
          btn.classList.add("is-on");
          if (key === "form") calcState.form = btn.getAttribute("data-val");
          if (key === "tax")  calcState.tax  = btn.getAttribute("data-val");
          if (key === "doc")  calcState.doc  = btn.getAttribute("data-val");
          renderCalc();
        });
      });
    });

    $("#turnoverRange").addEventListener("input", function () {
      calcState.turn = parseInt(this.value, 10); renderCalc();
    });
    $("#empRange").addEventListener("input", function () {
      calcState.emp = parseInt(this.value, 10); renderCalc();
    });

    $("#calcOrder").addEventListener("click", function () {
      var isMchj = calcState.form === "mchj" || calcState.form === "foreign";
      var aylanmaText = isMchj ? "Aylanmadan soliq (4%)" : "Aylanmadan soliq (1%)";
      var currentTaxLabel = (calcState.tax === "aylanma" || calcState.tax === "turnover")
        ? aylanmaText
        : (taxLabels[calcState.tax] || "QQS / Umumiy rejim");

      var price = groupThousands(computePrice()) + " soʻm/oy";
      var turnIdx = Math.min(Math.max(calcState.turn - 1, 0), turnoverLabels.length - 1);
      var empIdx = Math.min(Math.max(calcState.emp, 0), employeeLabels.length - 1);
      openLead({
        source: "Narx kalkulyatori",
        details: [
          formLabels[calcState.form], currentTaxLabel,
          turnoverLabels[turnIdx], employeeLabels[empIdx],
          docLabels[calcState.doc], price
        ].join(" · "),
        context: "Tanlangan tarif: " + price
      }, this);
    });

    renderCalc();
  }

  /* ---------------------------------------------------------
     7. express tax-risk audit (15 Questions & Score Logic)
     - 0-25 BALL: YASHIL ZONA (Xavf darajasi: YUQORI EMAS)
     - 26-60 BALL: SARIQ ZONA (Xavf darajasi: O'RTA)
     - 61-150 BALL: QIZIL ZONA (Xavf darajasi: YUQORI)
     --------------------------------------------------------- */
  var quiz = $("#quiz");
  if (quiz) {
    var qSteps = $$(".quiz-step", quiz);
    var qRes = $("#quizRes"), qBar = $("#quizBar"), qTitle = $("#quizTitle"), qPercent = $("#quizPercent");
    var qIndex = 0, totalScore = 0;
    var totalQuestions = qSteps.length;

    function showStep(i) {
      qSteps.forEach(function (s, n) { s.classList.toggle("is-on", n === i); });
      qRes.classList.remove("is-on");
      var pct = Math.round(((i + 1) / totalQuestions) * 100);
      qBar.style.width = pct + "%";
      qTitle.textContent = (i + 1) + "-savol / " + totalQuestions;
      qPercent.textContent = pct + "%";
    }

    function showResult() {
      qSteps.forEach(function (s) { s.classList.remove("is-on"); });
      qBar.style.width = "100%";
      qTitle.textContent = "Natija tayyor";
      qPercent.textContent = "100%";

      var zone = "green";
      var zoneTitle = "";
      var zoneDesc = "";
      var badgeClass = "low";
      var badgeText = "";

      if (totalScore <= 25) {
        zone = "green";
        badgeClass = "low";
        badgeText = "0–25 Ball: Yashil zona · Xavf darajasi: YUQORI EMAS";
        zoneTitle = "Buxgalteriyangiz yaxshi holatda!";
        zoneDesc = "Xavf darajasi: YUQORI EMAS. Buxgalteriyangiz yaxshi holatda. Qonunchilikdagi yangiliklarni kuzatib borish yetarli.";
      } else if (totalScore <= 60) {
        zone = "yellow";
        badgeClass = "mid";
        badgeText = "26–60 Ball: Sariq zona · Xavf darajasi: OʻRTA";
        zoneTitle = "Diqqat: Zaif nuqtalar aniqlandi!";
        zoneDesc = "Xavf darajasi: OʻRTA. Kameral tekshiruv va jarimalar solinishi mumkin boʻlgan zaif nuqtalar mavjud. Mutaxassis bilan profilaktik tahlil oʻtkazish tavsiya etiladi.";
      } else {
        zone = "red";
        badgeClass = "high";
        badgeText = "61–150 Ball: Qizil zona · Xavf darajasi: YUQORI";
        zoneTitle = "Jiddiy soliq va jarima xavfi mavjud!";
        zoneDesc = "Xavf darajasi: YUQORI. Yirik jarima va risklar mavjud. Zudlik bilan profilaktik audit zarur.";
      }

      auditResult = badgeText + " (" + totalScore + " ball)";
      var badge = $("#riskBadge");
      badge.className = "risk-badge " + badgeClass;
      badge.innerHTML = '<svg><use href="#i-' + (zone === 'green' ? "shield" : "warn") + '"/></svg>' + badgeText;
      $("#riskTitle").textContent = zoneTitle;
      $("#riskDesc").textContent = zoneDesc;
      qRes.classList.add("is-on");
    }

    $$(".quiz-opt", quiz).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var score = parseInt(btn.getAttribute("data-score") || "0", 10);
        totalScore += score;
        qIndex++;
        if (qIndex < totalQuestions) {
          showStep(qIndex);
        } else {
          showResult();
        }
      });
    });

    var restartBtn = $("#quizRestart");
    if (restartBtn) {
      restartBtn.addEventListener("click", function () {
        qIndex = 0;
        totalScore = 0;
        auditResult = "";
        showStep(0);
      });
    }

    showStep(0);
  }

  /* ---------------------------------------------------------
     8. FAQ accordion
     --------------------------------------------------------- */
  var accs = $$(".acc");
  accs.forEach(function (acc) {
    var btn = $(".acc-btn", acc), body = $(".acc-body", acc), inner = $(".acc-body-in", acc);
    btn.addEventListener("click", function () {
      var open = acc.classList.contains("is-open");
      accs.forEach(function (other) {
        if (other === acc) return;
        other.classList.remove("is-open");
        $(".acc-btn", other).setAttribute("aria-expanded", "false");
        $(".acc-body", other).style.height = "0px";
      });
      acc.classList.toggle("is-open", !open);
      btn.setAttribute("aria-expanded", String(!open));
      body.style.height = open ? "0px" : inner.scrollHeight + "px";
    });
  });
  window.addEventListener("resize", function () {
    accs.forEach(function (acc) {
      if (acc.classList.contains("is-open")) {
        var inner = $(".acc-body-in", acc);
        $(".acc-body", acc).style.height = inner.scrollHeight + "px";
      }
    });
  });

  /* ---------------------------------------------------------
     9. testimonial rail
     --------------------------------------------------------- */
  var rail = $("#rail"), dots = $("#dots"), prevBtn = $("#prevBtn"), nextBtn = $("#nextBtn"), sliderNav = $("#sliderNav");
  if (rail) {
    var cards = $$(".quote", rail);

    function step() {
      var st = window.getComputedStyle(rail);
      var gap = parseFloat(st.columnGap || st.gap) || 22;
      return cards[0].getBoundingClientRect().width + gap;
    }
    function maxIndex() {
      return Math.max(0, cards.length - Math.max(1, Math.round(rail.clientWidth / step())));
    }
    function buildDots() {
      var max = maxIndex();
      // with everything already visible there is nothing to page through
      var pageable = max > 0;
      sliderNav.style.display = pageable ? "" : "none";
      dots.style.display = pageable ? "" : "none";
      dots.innerHTML = "";
      if (!pageable) return;
      for (var i = 0; i <= max; i++) {
        var b = document.createElement("button");
        b.setAttribute("aria-label", (i + 1) + "-izohga oʻtish");
        b.dataset.i = i;
        b.addEventListener("click", function (e) {
          rail.scrollTo({ left: parseInt(e.currentTarget.dataset.i, 10) * step(), behavior: reduced ? "auto" : "smooth" });
        });
        dots.appendChild(b);
      }
      sync();
    }
    function sync() {
      if (dots.style.display === "none") return;
      var i = Math.round(rail.scrollLeft / step());
      $$("button", dots).forEach(function (d, n) { d.classList.toggle("is-active", n === i); });
      prevBtn.disabled = rail.scrollLeft < 8;
      nextBtn.disabled = rail.scrollLeft > rail.scrollWidth - rail.clientWidth - 8;
    }
    prevBtn.addEventListener("click", function () { rail.scrollBy({ left: -step(), behavior: reduced ? "auto" : "smooth" }); });
    nextBtn.addEventListener("click", function () { rail.scrollBy({ left: step(), behavior: reduced ? "auto" : "smooth" }); });
    rail.addEventListener("scroll", function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener("resize", buildDots);
    buildDots();
  }

  /* ---------------------------------------------------------
     10. pointer spotlight + gentle tilt on the sample report
     --------------------------------------------------------- */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine && !reduced) {
    $$(".card, .calc-form, .founder-quote").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        el.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
      });
    });

    var stage = $(".ledger-stage"), ledger = $("#ledger");
    if (stage && ledger) {
      stage.addEventListener("pointermove", function (e) {
        var r = stage.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ledger.style.setProperty("--mx", px * 100 + "%");
        ledger.style.setProperty("--my", py * 100 + "%");
        ledger.style.transition = "transform .2s ease-out";
        ledger.style.transform = "rotateY(" + (px - 0.5) * 6 + "deg) rotateX(" + (0.5 - py) * 5 + "deg)";
      });
      stage.addEventListener("pointerleave", function () {
        ledger.style.transition = "transform .7s cubic-bezier(.22,.72,.24,1)";
        ledger.style.transform = "";
      });
    }
  }

  /* ---------------------------------------------------------
     11. hero parallax
     --------------------------------------------------------- */
  if (!reduced) {
    var blobs = $$("[data-par]");
    var pTick = false;
    window.addEventListener("scroll", function () {
      if (pTick) return;
      pTick = true;
      window.requestAnimationFrame(function () {
        var y = window.scrollY;
        if (y < 1100) {
          blobs.forEach(function (b) {
            b.style.transform = "translate3d(0," + y * parseFloat(b.getAttribute("data-par")) + "px,0)";
          });
        }
        pTick = false;
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     12. seamless systems tape
     --------------------------------------------------------- */
  var tape = $("#tapeTrack");
  if (tape) tape.innerHTML += tape.innerHTML;

  /* the reporting board is labelled with the current month */
  var boardMonth = $("#boardMonth");
  if (boardMonth) {
    var months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
    var today = new Date();
    boardMonth.textContent = months[today.getMonth()] + " · " + today.getFullYear();
  }

  /* ---------------------------------------------------------
     13. leads
     Every contact button opens one form. It posts to /api/lead;
     the server numbers the lead (#N1, #N2 …) and forwards it to
     the Telegram group. The bot token never reaches the browser.
     --------------------------------------------------------- */
  var modal = $("#leadModal");
  var modalDialog = $(".lead-dialog", modal);
  var modalContext = $("#leadContext");
  var modalTrigger = null;
  var modalLead = { source: "", details: "" };
  var auditResult = "";

  function formatPhoneInput(value) {
    var d = value.replace(/\D/g, "");
    // with the +998 prefix typed the digits start with 998; a bare pasted
    // 9-digit local number (e.g. 998123456 for 99 812 34 56) stays as it is
    var bareLocal = d.length === 9 && value.trim().charAt(0) !== "+";
    if (!bareLocal && d.indexOf("998") === 0) d = d.slice(3);
    d = d.slice(0, 9);
    var out = "+998";
    if (d.length) out += " " + d.slice(0, 2);
    if (d.length > 2) out += " " + d.slice(2, 5);
    if (d.length > 5) out += " " + d.slice(5, 7);
    if (d.length > 7) out += " " + d.slice(7, 9);
    return out;
  }

  /* "" → "", "@name" / "name" / "t.me/name" → "name", anything else → null */
  function normalizeTelegram(value) {
    var v = value.trim();
    if (!v) return "";
    v = v.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "").replace(/[\/?#].*$/, "");
    return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(v) ? v : null;
  }

  function markField(input, bad) {
    input.closest(".lead-field").classList.toggle("has-error", bad);
    input.setAttribute("aria-invalid", bad ? "true" : "false");
  }

  function showAlert(box, text) {
    box.textContent = text;
    box.classList.add("is-on");
  }

  function scopeOf(form) {
    return form.closest("#leadModal") || form.closest(".form-card");
  }

  function showDone(form) {
    var scope = scopeOf(form);
    $(".lead-body", scope).style.display = "none";
    var done = $(".lead-done", scope);
    done.classList.add("is-on");
    var focusTarget = $("[data-close]", done);
    if (focusTarget) focusTarget.focus();
  }

  function resetIfDone(scope) {
    var done = $(".lead-done", scope);
    if (!done.classList.contains("is-on")) return;
    done.classList.remove("is-on");
    $(".lead-body", scope).style.display = "";
    var form = $(".lead-form", scope);
    form.reset();
    $$(".lead-field", form).forEach(function (f) { f.classList.remove("has-error"); });
    $(".lead-alert", form).classList.remove("is-on");
  }

  function lockScroll(on) {
    var gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = on ? "hidden" : "";
    document.body.style.paddingRight = on && gap > 0 ? gap + "px" : "";
    hdr.style.paddingRight = on && gap > 0 ? gap + "px" : "";
  }

  function openLead(lead, trigger) {
    modalLead = { source: lead.source || "Sayt", details: lead.details || "" };
    modalTrigger = trigger || document.activeElement;
    modalContext.textContent = lead.context || "";
    modalContext.classList.toggle("is-on", !!lead.context);
    resetIfDone(modal);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    lockScroll(true);
    var phoneInput = $('input[name="phone"]', modal);
    if (phoneInput) phoneInput.focus({ preventScroll: true });
  }

  function closeLead() {
    if (!modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    lockScroll(false);
    if (modalTrigger && modalTrigger.focus) modalTrigger.focus({ preventScroll: true });
  }

  $$("[data-close]", modal).forEach(function (el) { el.addEventListener("click", closeLead); });

  modal.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeLead(); return; }
    if (e.key !== "Tab") return;
    var focusable = $$("button, [href], input:not([tabindex='-1'])", modalDialog)
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-lead]");
    if (!trigger) return;
    e.preventDefault();
    var kind = trigger.getAttribute("data-lead");

    if (kind === "service") {
      var heading = trigger.closest(".card").querySelector("h3");
      var service = heading ? heading.textContent.trim() : "";
      openLead({ source: "Xizmat — " + service, context: "Xizmat: " + service }, trigger);
    } else if (kind === "audit") {
      openLead({
        source: "Ekspress audit — " + trigger.textContent.trim(),
        details: auditResult,
        context: auditResult ? "Audit natijasi: " + auditResult : ""
      }, trigger);
    } else {
      openLead({ source: kind }, trigger);
    }
  });

  $$(".lead-form").forEach(function (form) {
    var phoneInput = $('input[name="phone"]', form);
    var tgInput = $('input[name="telegram"]', form);
    var honeypot = $('input[name="website"]', form);
    var alertBox = $(".lead-alert", form);
    var button = $('button[type="submit"]', form);
    var buttonHtml = button.innerHTML;

    phoneInput.addEventListener("input", function () {
      phoneInput.value = formatPhoneInput(phoneInput.value);
      markField(phoneInput, false);
    });
    phoneInput.addEventListener("focus", function () { if (!phoneInput.value) phoneInput.value = "+998 "; });
    phoneInput.addEventListener("blur", function () {
      if (phoneInput.value.replace(/\D/g, "") === "998") phoneInput.value = "";
    });
    tgInput.addEventListener("input", function () { markField(tgInput, false); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (button.disabled) return;
      alertBox.classList.remove("is-on");

      var digits = phoneInput.value.replace(/\D/g, "");
      var phoneOk = digits.length === 12 && digits.indexOf("998") === 0;
      var telegram = normalizeTelegram(tgInput.value);
      markField(phoneInput, !phoneOk);
      markField(tgInput, telegram === null);
      if (!phoneOk) { phoneInput.focus(); return; }
      if (telegram === null) { tgInput.focus(); return; }

      var inModal = !!form.closest("#leadModal");
      var payload = {
        phone: digits,
        telegram: telegram,
        source: inModal ? modalLead.source : form.getAttribute("data-source"),
        details: inModal ? modalLead.details : "",
        website: honeypot.value
      };

      button.disabled = true;
      button.textContent = "Yuborilmoqda…";

      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          return response.json()
            .catch(function () { return {}; })
            .then(function (data) { return { status: response.status, data: data }; });
        })
        .then(function (result) {
          if (result.data.ok) { showDone(form); return; }
          var error = result.data.error;
          if (error === "phone") { markField(phoneInput, true); phoneInput.focus(); }
          else if (error === "telegram") { markField(tgInput, true); tgInput.focus(); }
          else if (result.status === 429) {
            showAlert(alertBox, "Juda koʻp soʻrov yuborildi. Bir necha daqiqadan soʻng qayta urinib koʻring.");
          } else {
            showAlert(alertBox, "Soʻrov yuborilmadi. Birozdan soʻng qayta urinib koʻring.");
          }
        })
        .catch(function () {
          showAlert(alertBox, "Server bilan aloqa yoʻq. Internetni tekshirib, qayta urinib koʻring.");
        })
        .then(function () {
          button.disabled = false;
          button.innerHTML = buttonHtml;
        });
    });
  });

  /* ---------------------------------------------------------
     14. anchor scrolling that respects the fixed header
     --------------------------------------------------------- */
  $$('a[href^="#"]:not([data-lead])').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      var target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: Math.max(top, 0), behavior: reduced ? "auto" : "smooth" });
      if (history.replaceState) history.replaceState(null, "", id);
    });
  });
})();

>
(function () {
  var messagesHistory = [];
  var isSending = false;

  var messagesList = document.getElementById('aiMessagesList');
  var chatForm = document.getElementById('aiChatForm');
  var msgInput = document.getElementById('aiMessageInput');
  var sendBtn = document.getElementById('aiSendBtn');
  var resetBtn = document.getElementById('aiResetBtn');
  var presets = document.getElementById('aiPresets');

  function scrollChat() {
    if (messagesList) messagesList.scrollTop = messagesList.scrollHeight;
  }

  function autoGrow() {
    if (!msgInput) return;
    msgInput.style.height = 'auto';
    var minH = window.innerWidth <= 640 ? 44 : 48;
    msgInput.style.height = Math.max(minH, Math.min(msgInput.scrollHeight, 120)) + 'px';
  }

  if (msgInput) {
    msgInput.addEventListener('input', autoGrow);
    msgInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  }

  window.copyAiText = function (btn) {
    var bubble = btn.closest('.ai-msg').querySelector('.ai-bubble');
    if (!bubble) return;
    var text = bubble.getAttribute('data-raw') || bubble.innerText;
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.innerHTML;
      btn.innerHTML = '✓ Nusxalandi';
      setTimeout(function () { btn.innerHTML = orig; }, 2000);
    });
  };

  function appendUserMsg(text) {
    var msg = document.createElement('div');
    msg.className = 'ai-msg ai-msg--user';
    msg.innerHTML = '<div class="ai-msg-av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>' +
      '<div class="ai-msg-body"><div class="ai-bubble">' + escapeHtml(text) + '</div></div>';
    messagesList.appendChild(msg);
    scrollChat();
  }

  function escapeHtml(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  }

  function parseMd(text) {
    if (window.marked && window.marked.parse) {
      try { return window.marked.parse(text); } catch (e) {}
    }
    return escapeHtml(text);
  }

  async function handleSend(text) {
    var q = (text || (msgInput ? msgInput.value : '')).trim();
    if (!q || isSending) return;

    isSending = true;
    if (sendBtn) sendBtn.disabled = true;
    if (msgInput) { msgInput.value = ''; autoGrow(); }

    messagesHistory.push({ role: 'user', content: q });
    appendUserMsg(q);

    // Bot message bubble
    var botMsg = document.createElement('div');
    botMsg.className = 'ai-msg ai-msg--bot';
    botMsg.innerHTML = '<div class="ai-msg-av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></div>' +
      '<div class="ai-msg-body"><div class="ai-bubble ai-typing">Javob tayyorlanmoqda...</div>' +
      '<div class="ai-actions" style="display:none;"><button type="button" class="ai-action-btn" onclick="copyAiText(this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Nusxa olish</button></div></div>';
    messagesList.appendChild(botMsg);
    scrollChat();

    var bubble = botMsg.querySelector('.ai-bubble');
    var actions = botMsg.querySelector('.ai-actions');
    var fullText = '';

    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesHistory, stream: true })
      });
      if (!res.ok) {
        var errJson = await res.json().catch(function() { return {}; });
        throw new Error(errJson.error || 'Server xatosi: ' + res.status);
      }
      if (res.body) {
        bubble.innerHTML = '';
        var reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buf = '';
        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          buf += decoder.decode(chunk.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var l = lines[i].trim();
            if (!l.startsWith('data:')) continue;
            var d = l.slice(5).trim();
            if (d === '[DONE]') continue;
            try {
              var json = JSON.parse(d);
              var token = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
              if (token) {
                fullText += token;
                bubble.innerHTML = parseMd(fullText);
                scrollChat();
              }
            } catch (e) {}
          }
        }
      }

      bubble.classList.remove('ai-typing');
      bubble.setAttribute('data-raw', fullText);
      if (actions) actions.style.display = 'flex';
      messagesHistory.push({ role: 'assistant', content: fullText });
    } catch (err) {
      bubble.classList.remove('ai-typing');
      bubble.innerHTML = '<span style="color:#dc2626;">Kechirasiz, xatolik yuz berdi: ' + ((err && err.message) || err) + '. Iltimos qayta urinib ko\'ring.</span>';
    } finally {
      isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      scrollChat();
    }
  }

  if (chatForm) {
    chatForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handleSend();
    });
  }

  if (presets) {
    presets.addEventListener('click', function (e) {
      var btn = e.target.closest('.ai-chip');
      if (btn) {
        var p = btn.getAttribute('data-prompt');
        if (p) handleSend(p);
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      messagesHistory = [];
      messagesList.innerHTML = '<div class="ai-msg ai-msg--bot"><div class="ai-msg-av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></div>' +
        '<div class="ai-msg-body"><div class="ai-bubble"><p>Assalomu alaykum! Men <strong>United Finance AI</strong> buxgalteriya va soliq maslahatchisiman.</p><p>Yangi savolingizni yozing yoki yuqoridagi tezkor tugmalardan birini tanlang.</p></div></div></div>';
      if (msgInput) msgInput.focus();
    });
  }
})();