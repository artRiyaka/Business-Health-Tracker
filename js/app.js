(function () {
  const AUTH_KEY = "till.auth";
  const DATA_KEY = "till.business.v1";
  const AI_KEY = "till.openai";
  const FILLED_ACCESS = "********";

  const $ = function (id) {
    return document.getElementById(id);
  };

  const state = {
    business: null,
    metrics: null,
    step: 0,
    variant: 0,
    inflight: false,
    tick: 0,
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadBusiness() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name && parsed.price != null) return parsed;
      }
    } catch (error) {
      /* keep the sample */
    }
    return clone(TillDemo.business);
  }

  function saveBusiness(business) {
    localStorage.setItem(DATA_KEY, JSON.stringify(business));
  }

  function kindLabel(id) {
    const match = TillDemo.kinds.find(function (item) {
      return item.id === id;
    });
    return match ? match.label : "Business";
  }

  function sameAsDemo(business) {
    const demo = TillDemo.business;
    if (business.name.trim() !== demo.name || business.kind !== demo.kind) return false;
    const keys = ["investment", "rent", "wages", "utilities", "other", "cost", "price", "units"];
    return keys.every(function (key) {
      return Math.abs(Number(business[key]) - Number(demo[key])) < 0.001;
    });
  }

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach(function (screen) {
      const on = screen.id === id;
      screen.hidden = !on;
      screen.classList.toggle("is-on", on);
    });
    window.scrollTo(0, 0);
  }

  function guardIdentity() {
    const username = $("username");
    if (!username.value.trim() || username.value.indexOf("@") !== -1) {
      username.value = TillDemo.username;
    }
    if (!$("access").value) $("access").value = FILLED_ACCESS;
  }

  function signIn(event) {
    event.preventDefault();
    guardIdentity();
    const button = $("login-submit");
    button.disabled = true;
    button.textContent = "Opening";
    window.setTimeout(function () {
      sessionStorage.setItem(AUTH_KEY, "1");
      button.disabled = false;
      button.textContent = "Sign in";
      enter();
    }, reduceMotion() ? 0 : 280);
  }

  function signOut() {
    sessionStorage.removeItem(AUTH_KEY);
    show("login");
    $("login-submit").focus();
  }

  function enter() {
    state.business = loadBusiness();
    state.variant = 0;
    show("dash");
    present(false);
  }

  function setVal(el, text, tone) {
    el.textContent = text;
    el.className = "val" + (tone ? " is-" + tone : "");
  }

  function countUp(el, target) {
    const id = ++state.tick;
    if (reduceMotion()) {
      el.textContent = TillCalc.count(target);
      return;
    }
    const start = performance.now();
    const duration = 700;
    function frame(now) {
      if (id !== state.tick) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = TillCalc.count(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function renderDash(metrics) {
    const business = state.business;
    const hero = metrics.hero;
    $("dash").dataset.status = metrics.status;
    $("biz-name").textContent = business.name;
    $("biz-meta").textContent =
      kindLabel(business.kind) + " · " + (business.source === "sample" ? "Sample numbers" : "Saved on this device");
    $("chip-label").textContent = metrics.statusLabel;
    $("status-line").textContent = metrics.statusLine;

    const heroNum = $("hero-num");
    heroNum.setAttribute("aria-label", hero.text + " " + hero.caption);
    $("hero-cap").textContent = hero.caption;

    if (hero.kind === "count") countUp(heroNum, hero.value);
    else heroNum.textContent = hero.text;

    const bar = $("bar");
    const fill = $("bar-fill");
    const barText = $("bar-text");
    const showBar = hero.bar != null;
    bar.hidden = !showBar;
    barText.hidden = !showBar;
    if (showBar) {
      bar.setAttribute("aria-valuenow", String(hero.bar));
      bar.setAttribute("aria-label", hero.bar + " percent of the way to break-even");
      barText.textContent = hero.barText;
      if (reduceMotion()) fill.style.width = hero.bar + "%";
      else {
        fill.style.width = "0%";
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            fill.style.width = hero.bar + "%";
          });
        });
      }
    }

    const netTone = metrics.net > 0 ? "pos" : metrics.net < 0 ? "neg" : "muted";
    setVal($("stat-net"), TillCalc.money(metrics.net), netTone);

    if (metrics.breakEvenSales == null) setVal($("stat-even"), "Not possible yet", "muted");
    else if (metrics.fixed === 0) setVal($("stat-even"), "No bills to cover", "muted");
    else {
      const n = metrics.breakEvenSales;
      setVal($("stat-even"), TillCalc.count(n) + (n === 1 ? " sale" : " sales"), "");
    }

    const payTone = metrics.paybackLabel === "Not yet" || metrics.paybackLabel === "Nothing to earn back" ? "muted" : "";
    setVal($("stat-pay"), metrics.paybackLabel, payTone);

    $("restore").hidden = business.source === "sample";
    document.title = metrics.statusLabel + " · Till";
  }

  function setSuggestion(text, note) {
    const el = $("suggestion");
    el.classList.remove("is-wait");
    el.removeAttribute("aria-busy");
    el.textContent = text;
    el.classList.remove("is-in");
    void el.offsetWidth;
    el.classList.add("is-in");
    $("suggestion-note").textContent = note || "";
    $("live").textContent =
      state.metrics.statusLabel +
      ". " +
      state.metrics.hero.text +
      " " +
      state.metrics.hero.caption +
      ". " +
      text;
  }

  function present(useNetwork) {
    state.metrics = TillCalc.analyze(state.business);
    renderDash(state.metrics);
    const key = localStorage.getItem(AI_KEY) || "";
    const local = TillInsight.localSuggestion(state.business, state.metrics, state.variant);
    setSuggestion(local, "");
    if (useNetwork && key) upgrade(key);
  }

  async function upgrade(key) {
    if (state.inflight) return;
    state.inflight = true;
    const el = $("suggestion");
    el.classList.add("is-wait");
    el.setAttribute("aria-busy", "true");
    const result = await TillInsight.compose(state.business, state.metrics, key, state.variant);
    state.inflight = false;
    const note = result.via === "openai" ? "From OpenAI" : result.error;
    setSuggestion(result.text, note);
  }

  async function rewrite() {
    state.variant += 1;
    const key = localStorage.getItem(AI_KEY) || "";
    if (!key) {
      setSuggestion(TillInsight.localSuggestion(state.business, state.metrics, state.variant), "");
      return;
    }
    await upgrade(key);
  }

  function fieldText(id) {
    return $(id).value.trim().replace(/[$,]/g, "");
  }

  function peek(id) {
    const raw = fieldText(id);
    if (raw === "") return 0;
    if (!/^\d*\.?\d*$/.test(raw) || raw === ".") return null;
    return parseFloat(raw);
  }

  function writeForm(business) {
    $("biz-name-input").value = business.name;
    $("kind").value = business.kind;
    $("investment").value = String(business.investment);
    $("rent").value = String(business.rent);
    $("wages").value = String(business.wages);
    $("utilities").value = String(business.utilities);
    $("other").value = String(business.other);
    $("cost").value = Number(business.cost).toFixed(2);
    $("price").value = Number(business.price).toFixed(2);
    $("units").value = String(business.units);
    updateLive();
  }

  function updateLive() {
    const bills = ["rent", "wages", "utilities", "other"].map(peek);
    const billsEl = $("live-bills");
    if (bills.some(function (n) { return n == null; })) {
      billsEl.textContent = "Use a plain number, like 2800.";
      billsEl.classList.add("is-bad");
    } else {
      const total = bills.reduce(function (sum, n) { return sum + n; }, 0);
      billsEl.textContent = "Bills each month · " + TillCalc.money(total);
      billsEl.classList.remove("is-bad");
    }

    const cost = peek("cost");
    const price = peek("price");
    const keepEl = $("live-keep");
    if (cost == null || price == null) {
      keepEl.textContent = "Use a plain number, like 5.50.";
      keepEl.classList.add("is-bad");
    } else if (!(price > 0)) {
      keepEl.textContent = "Add the price you charge.";
      keepEl.classList.add("is-bad");
    } else if (price - cost <= 0) {
      keepEl.textContent = "Lost on each sale · " + TillCalc.money(Math.abs(price - cost), 2);
      keepEl.classList.add("is-bad");
    } else {
      keepEl.textContent = "Left on each sale · " + TillCalc.money(price - cost, 2);
      keepEl.classList.remove("is-bad");
    }

    const units = peek("units");
    const incoming = $("live-in");
    if (units == null || price == null) {
      incoming.textContent = "Use a plain number.";
      incoming.classList.add("is-bad");
    } else {
      incoming.textContent = "Coming in from sales · " + TillCalc.money(units * (price || 0));
      incoming.classList.remove("is-bad");
    }
  }

  function showError(message) {
    const el = $("form-error");
    el.hidden = !message;
    el.textContent = message || "";
  }

  function validateStep(step) {
    if (step === 0) {
      if (!$("biz-name-input").value.trim()) return "Add a business name.";
      if (peek("investment") == null) return "Use a plain number for startup money.";
      return "";
    }
    if (step === 1) {
      const ids = ["rent", "wages", "utilities", "other"];
      for (let i = 0; i < ids.length; i += 1) {
        if (peek(ids[i]) == null) return "Use plain numbers for the bills.";
      }
      return "";
    }
    if (step === 2) {
      if (peek("cost") == null) return "Use a plain number for the cost.";
      const price = peek("price");
      if (price == null) return "Use a plain number for the price.";
      if (!(price > 0)) return "Add the price you charge.";
      return "";
    }
    if (peek("units") == null) return "Use a plain number for sales.";
    return "";
  }

  function setStep(step, dir) {
    state.step = step;
    $("wizard-form").classList.toggle("is-back", dir < 0);
    document.querySelectorAll(".step").forEach(function (panel, index) {
      const on = index === step;
      panel.hidden = !on;
      panel.classList.toggle("is-on", on);
    });
    $("ticks").querySelectorAll("i").forEach(function (tick, index) {
      tick.classList.toggle("is-on", index <= step);
    });
    $("back").hidden = step === 0;
    $("next").textContent = step === 3 ? "See the answer" : "Continue";
    showError("");
    const heading = document.querySelector('.step[data-step="' + step + '"] h1');
    if (heading) heading.focus({ preventScroll: true });
  }

  function openWizard() {
    writeForm(state.business);
    show("wizard");
    setStep(0, 1);
  }

  function readBusiness() {
    const business = {
      name: $("biz-name-input").value.trim().slice(0, 40),
      kind: $("kind").value,
      investment: peek("investment") || 0,
      rent: peek("rent") || 0,
      wages: peek("wages") || 0,
      utilities: peek("utilities") || 0,
      other: peek("other") || 0,
      cost: peek("cost") || 0,
      price: peek("price") || 0,
      units: peek("units") || 0,
      source: "saved",
    };
    if (sameAsDemo(business)) business.source = "sample";
    return business;
  }

  function nextStep() {
    const message = validateStep(state.step);
    if (message) {
      showError(message);
      $("form-error").scrollIntoView({ block: "nearest" });
      return;
    }
    if (state.step < 3) {
      setStep(state.step + 1, 1);
      return;
    }
    state.business = readBusiness();
    saveBusiness(state.business);
    state.variant = 0;
    show("dash");
    present(true);
  }

  function prevStep() {
    if (state.step === 0) {
      show("dash");
      return;
    }
    setStep(state.step - 1, -1);
  }

  function restore() {
    localStorage.removeItem(DATA_KEY);
    state.business = clone(TillDemo.business);
    state.variant = 0;
    $("restore").textContent = "Restore sample numbers";
    $("restore").dataset.armed = "";
    present(false);
  }

  function armRestore() {
    const button = $("restore");
    if (button.dataset.armed === "1") {
      restore();
      return;
    }
    button.dataset.armed = "1";
    button.textContent = "Tap again to restore the sample";
    window.setTimeout(function () {
      if (button.dataset.armed === "1") {
        button.dataset.armed = "";
        button.textContent = "Restore sample numbers";
      }
    }, 2600);
  }

  function openSheet() {
    const key = localStorage.getItem(AI_KEY) || "";
    $("key-input").value = key;
    $("key-msg").hidden = true;
    $("key-clear").hidden = !key;
    $("sheet").hidden = false;
    document.body.classList.add("sheet-open");
    $("key-input").focus();
  }

  function closeSheet() {
    $("sheet").hidden = true;
    document.body.classList.remove("sheet-open");
  }

  async function saveKey(event) {
    event.preventDefault();
    const key = $("key-input").value.trim();
    const msg = $("key-msg");
    if (!key) {
      msg.hidden = false;
      msg.textContent = "Paste a key, or close this and keep the built-in suggestion.";
      return;
    }
    localStorage.setItem(AI_KEY, key);
    $("key-save").disabled = true;
    const result = await TillInsight.compose(state.business, state.metrics, key, state.variant);
    $("key-save").disabled = false;
    if (result.via !== "openai") {
      msg.hidden = false;
      msg.textContent = result.error;
      setSuggestion(result.text, result.error);
      return;
    }
    closeSheet();
    setSuggestion(result.text, "From OpenAI");
  }

  function clearKey() {
    localStorage.removeItem(AI_KEY);
    $("key-input").value = "";
    closeSheet();
    setSuggestion(TillInsight.localSuggestion(state.business, state.metrics, state.variant), "");
  }

  function init() {
    $("username").value = TillDemo.username;
    $("access").value = FILLED_ACCESS;
    $("login-form").addEventListener("submit", signIn);
    $("sign-out").addEventListener("click", signOut);
    $("edit").addEventListener("click", openWizard);
    $("wizard-close").addEventListener("click", function () {
      show("dash");
    });
    $("wizard-form").addEventListener("submit", function (event) {
      event.preventDefault();
      nextStep();
    });
    $("wizard-form").addEventListener("input", updateLive);
    $("back").addEventListener("click", prevStep);
    $("restore").addEventListener("click", armRestore);
    $("rewrite").addEventListener("click", function () {
      rewrite();
    });
    $("open-key").addEventListener("click", openSheet);
    $("sheet").addEventListener("click", function (event) {
      if (event.target === $("sheet")) closeSheet();
    });
    $("key-form").addEventListener("submit", saveKey);
    $("key-clear").addEventListener("click", clearKey);
    $("sheet-close").addEventListener("click", closeSheet);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !$("sheet").hidden) closeSheet();
    });

    if (sessionStorage.getItem(AUTH_KEY) === "1") enter();
    else {
      show("login");
      $("login-submit").focus();
    }
  }

  init();
})();
