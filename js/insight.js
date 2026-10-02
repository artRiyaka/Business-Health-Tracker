(function (root) {
  const SYSTEM = [
    "You help a small business owner who has never studied accounting.",
    "Write exactly two short sentences. One practical suggestion only.",
    "Use the figures you are given. Do not invent numbers.",
    "Use plain words a café owner, online seller, or service provider would say out loud.",
    "Do not use these words: revenue, margin, overhead, COGS, EBITDA, ROI, profit margin, net income, gross.",
    "If additionalSalesToBreakEven is null, do not tell them to sell more. Tell them to fix the price or the cost.",
    "No greeting, no sign-off, no bullet list.",
  ].join(" ");

  function calc() {
    return root.TillCalc;
  }

  function salesPhrase(n) {
    const c = Math.max(0, Math.round(n));
    return calc().count(c) + (c === 1 ? " sale" : " sales");
  }

  function morePhrase(n) {
    const c = Math.max(0, Math.round(n));
    return calc().count(c) + (c === 1 ? " more sale" : " more sales");
  }

  function largestBill(business) {
    const rows = [
      { name: "rent", amount: business.rent, i: 0 },
      { name: "staff pay", amount: business.wages, i: 1 },
      { name: "utilities", amount: business.utilities, i: 2 },
      { name: "other costs", amount: business.other, i: 3 },
    ];
    rows.sort(function (a, b) {
      return b.amount - a.amount || a.i - b.i;
    });
    return rows[0];
  }

  function extraAtPrice(metrics, price) {
    const keep = price - metrics.cost;
    if (!(keep > 0)) return null;
    if (metrics.fixed === 0) return 0;
    return Math.max(0, Math.ceil(metrics.fixed / keep - metrics.units));
  }

  function localSuggestion(business, metrics, variant) {
    const v = Math.abs(variant || 0) % 2;
    const money = calc().money;

    if (!(metrics.price > 0)) {
      return "Add the price you charge for a typical sale. Everything else depends on that number.";
    }

    if (!(metrics.keep > 0)) {
      const loss = money(Math.abs(metrics.keep), 2);
      const floor = money(metrics.cost, 2);
      if (v === 0) {
        return "Each sale loses " + loss + ", so selling more would dig a deeper hole. Raise the price above " + floor + ", or lower what that sale costs you.";
      }
      return "The price is below what the sale costs you. Fix that before chasing more sales — each one currently loses " + loss + ".";
    }

    if (metrics.fixed === 0) {
      if (!(metrics.investment > 0)) {
        return "There are no monthly bills and no startup money to earn back. Each sale leaves " + money(metrics.keep, 2) + ".";
      }
      const earned = metrics.units * metrics.keep;
      const remaining = metrics.investment - earned;
      if (remaining <= 0) {
        return "There are no monthly bills, and the startup money is already earned back. Each sale leaves " + money(metrics.keep, 2) + ".";
      }
      const needed = Math.ceil(remaining / metrics.keep);
      const phrase = metrics.units > 0 ? morePhrase(needed) : salesPhrase(needed);
      return "There are no monthly bills in these numbers. About " + phrase + " would earn back the remaining " + money(remaining) + ".";
    }

    if (metrics.gap > 0 && metrics.keep / metrics.price < 0.5) {
      const bumped = extraAtPrice(metrics, metrics.price + 0.5);
      const kept = money(metrics.keep, 2);
      const price = money(metrics.price, 2);
      if (bumped === 0) {
        return "Only " + kept + " of the " + price + " price is left to pay the bills. Adding $0.50 to the price would cover this month without any extra sales.";
      }
      return "Only " + kept + " of the " + price + " price is left to pay the bills. Adding $0.50 to the price would bring the extra sales you need from " + calc().count(metrics.gap) + " down to " + calc().count(bumped) + ".";
    }

    if (metrics.gap > 0) {
      const short = money(metrics.shortfall);
      const daily = metrics.perDay ? ", roughly " + calc().count(metrics.perDay) + " a day," : "";
      if (metrics.coverage >= 0.75) {
        if (v === 0) {
          return "You are " + short + " short of covering this month's bills. About " + morePhrase(metrics.gap) + daily + " would get you there.";
        }
        return "About " + morePhrase(metrics.gap) + daily + " would cover this month's bills. That closes the " + short + " gap.";
      }
      const bill = largestBill(business);
      const billBit = bill.amount > 0 ? " — " + bill.name + " is the largest bill, at " + money(bill.amount) : "";
      if (v === 0) {
        return "You are " + short + " short of the monthly bills. About " + morePhrase(metrics.gap) + daily + " would close it" + billBit + ".";
      }
      return "The bills need " + salesPhrase(metrics.breakEvenSales) + ", and " + salesPhrase(metrics.units) + " are recorded. About " + morePhrase(metrics.gap) + " would cover them" + billBit + ".";
    }

    if (metrics.status === "yellow") {
      const cushion = Math.max(1, Math.ceil(metrics.breakEven * 1.1 - metrics.units));
      return "The bills are covered, with " + money(metrics.net) + " left this month. About " + morePhrase(cushion) + " would make the month sturdier if a few days go quiet.";
    }

    if (!(metrics.investment > 0)) {
      return "The bills are covered, with " + money(metrics.net) + " left this month. There is no startup money left to earn back.";
    }

    if (!metrics.paybackPhrase) {
      return "The bills are covered, with " + money(metrics.net) + " left this month.";
    }
    if (v === 0) {
      return "The bills are covered, with " + money(metrics.net) + " left this month. At this pace the " + money(metrics.investment) + " you put in to start comes back " + metrics.paybackPhrase + ".";
    }
    return "You are past the point where sales cover the bills, with " + money(metrics.net) + " left. Keep this pace and the startup money is back " + metrics.paybackPhrase + ".";
  }

  function payload(business, metrics) {
    const kinds = { cafe: "café", shop: "online shop", service: "service business" };
    const bill = largestBill(business);
    return {
      business: business.name,
      type: kinds[business.kind] || "small business",
      startupMoney: metrics.investment,
      monthlyBills: metrics.fixed,
      largestMonthlyBill: bill.amount > 0 ? bill.name + " " + calc().money(bill.amount) : "none",
      priceOfTypicalSale: metrics.price,
      costOfTypicalSale: metrics.cost,
      moneyLeftOnEachSale: metrics.keep,
      salesThisMonth: metrics.units,
      moneyComingIn: metrics.salesIn,
      moneyLeftThisMonth: metrics.net,
      breakEvenSales: metrics.breakEvenSales,
      additionalSalesToBreakEven: metrics.gap,
      extraSalesPerDayOver30Days: metrics.perDay,
      payback: metrics.paybackLabel,
      status: metrics.statusLabel,
    };
  }

  function twoSentences(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    const parts = clean.match(/[^.!?]+[.!?]+/g);
    if (!parts) return clean;
    return parts.slice(0, 2).join(" ").trim();
  }

  async function fromOpenAI(business, metrics, apiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 160,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(payload(business, metrics)) },
        ],
      }),
    });

    if (!response.ok) {
      const error = new Error("OpenAI request failed");
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const trimmed = twoSentences(text);
    if (!trimmed) throw new Error("Empty suggestion");
    if (/\b(ebitda|cogs|roi|overhead|net income)\b/i.test(trimmed)) throw new Error("Jargon");
    return trimmed;
  }

  function explain(error) {
    if (error && (error.status === 401 || error.status === 403)) return "That key was declined. The built-in suggestion is still on the page.";
    if (error && error.status === 429) return "OpenAI is busy right now. The built-in suggestion is still on the page.";
    if (error && error.name === "TypeError") return "The browser blocked the OpenAI request. The built-in suggestion is still on the page.";
    return "Could not reach OpenAI. The built-in suggestion is still on the page.";
  }

  async function compose(business, metrics, apiKey, variant) {
    const local = localSuggestion(business, metrics, variant || 0);
    if (!apiKey) return { text: local, via: "local", error: "" };
    try {
      const text = await fromOpenAI(business, metrics, apiKey);
      return { text: text, via: "openai", error: "" };
    } catch (error) {
      return { text: local, via: "local", error: explain(error) };
    }
  }

  const api = { localSuggestion: localSuggestion, compose: compose, payload: payload };
  root.TillInsight = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
