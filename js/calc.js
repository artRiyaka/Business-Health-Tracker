(function (root) {
  function num(n) {
    const value = Number(n);
    return Number.isFinite(value) ? value : 0;
  }

  function round2(n) {
    return Math.round((num(n) + Number.EPSILON) * 100) / 100;
  }

  function count(n) {
    const rounded = Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Math.round(n * 10) / 10;
    return rounded.toLocaleString("en-US");
  }

  function money(n, digits) {
    const value = round2(n);
    const d = digits == null ? (Math.abs(value - Math.round(value)) < 0.001 ? 0 : 2) : digits;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(value);
  }

  function ceilSales(n) {
    const near = Math.round(n);
    if (Math.abs(n - near) < 1e-6) return near;
    return Math.ceil(n);
  }

  function paybackLabel(months, investment, net) {
    if (!(investment > 0)) return "Nothing to earn back";
    if (!(net > 0) || months == null) return "Not yet";
    if (months < 1) return "Under a month";
    const rounded = Math.round(months);
    if (rounded > 240) return "Over 20 years";
    if (rounded >= 24) {
      const years = Math.round(rounded / 12);
      return "About " + years + " years";
    }
    return rounded + (rounded === 1 ? " month" : " months");
  }

  function paybackPhrase(label) {
    if (label === "Under a month") return "in under a month";
    if (label === "Over 20 years") return "in over 20 years";
    if (/^About /.test(label)) return label.replace(/^About /, "in about ");
    if (/month/.test(label)) return "in " + label;
    return null;
  }

  function statusFor(keep, net, coverage) {
    if (!(keep > 0)) return "red";
    if (net > 0 && coverage >= 1.1) return "green";
    if (net < 0 && coverage < 0.75) return "red";
    return "yellow";
  }

  function statusLine(status, price, keep, fixed, units, net) {
    if (!(price > 0)) return "A price is needed before this can be answered.";
    if (!(keep > 0)) return "The price does not cover what a sale costs.";
    if (fixed === 0 && units === 0) return "No monthly bills, and no sales yet.";
    if (fixed === 0 && units > 0) return "There are no monthly bills, and each sale brings money in.";
    if (status === "green") return "The monthly bills are covered, with room to spare.";
    if (status === "yellow" && net >= 0) return "The bills are covered, but only just.";
    if (status === "yellow") return "A little short of the monthly bills.";
    return "Well behind the monthly bills.";
  }

  function analyze(input) {
    const price = round2(input.price);
    const cost = round2(input.cost);
    const units = round2(input.units);
    const investment = round2(input.investment);
    const rent = round2(input.rent);
    const wages = round2(input.wages);
    const utilities = round2(input.utilities);
    const other = round2(input.other);
    const fixed = round2(rent + wages + utilities + other);
    const keep = round2(price - cost);
    const salesIn = round2(units * price);
    const net = round2(salesIn - round2(units * cost) - fixed);

    let breakEven = null;
    let breakEvenSales = null;
    let gap = null;
    let coverage = 0;
    let perDay = null;

    if (keep > 0 && fixed > 0) {
      breakEven = fixed / keep;
      breakEvenSales = ceilSales(breakEven);
      gap = Math.max(0, ceilSales(breakEven - units));
      coverage = units / breakEven;
      if (gap >= 15) perDay = Math.max(1, Math.round(gap / 30));
    } else if (keep > 0 && fixed === 0) {
      breakEven = 0;
      breakEvenSales = 0;
      gap = 0;
      coverage = 1;
    }

    let status = statusFor(keep, net, coverage);
    if (keep > 0 && fixed === 0) status = units > 0 ? "green" : "yellow";
    const labels = { green: "Making money", yellow: "Close", red: "Short" };
    const months = net > 0 ? investment / net : null;
    const label = paybackLabel(months, investment, net);

    let hero;
    if (!(price > 0)) {
      hero = {
        kind: "empty",
        value: 0,
        text: "—",
        caption: "Add a price for a typical sale",
        bar: null,
        barText: "",
      };
    } else if (!(keep > 0)) {
      hero = {
        kind: "text",
        value: 0,
        text: money(Math.abs(keep), 2),
        caption: "lost on every sale",
        bar: null,
        barText: "",
      };
    } else if (fixed === 0) {
      hero = {
        kind: "count",
        value: 0,
        text: "0",
        caption: "more sales to break even",
        bar: units > 0 ? 100 : 0,
        barText: "No monthly bills to cover",
      };
    } else {
      hero = {
        kind: "count",
        value: gap,
        text: count(gap),
        caption: gap === 1 ? "more sale to break even" : "more sales to break even",
        bar: Math.round(Math.max(0, Math.min(100, (units / breakEven) * 100))),
        barText:
          gap > 0
            ? count(units) + " of " + count(breakEvenSales) + " sales"
            : count(units) + " sales · break-even is " + count(breakEvenSales),
      };
    }

    return {
      price: price,
      cost: cost,
      units: units,
      investment: investment,
      rent: rent,
      wages: wages,
      utilities: utilities,
      other: other,
      fixed: fixed,
      keep: keep,
      salesIn: salesIn,
      net: net,
      shortfall: net < 0 ? round2(-net) : 0,
      breakEven: breakEven,
      breakEvenSales: breakEvenSales,
      gap: gap,
      coverage: coverage,
      perDay: perDay,
      paybackMonths: months,
      paybackLabel: label,
      paybackPhrase: paybackPhrase(label),
      status: status,
      statusLabel: labels[status],
      statusLine: statusLine(status, price, keep, fixed, units, net),
      hero: hero,
    };
  }

  const api = { analyze: analyze, money: money, count: count, round2: round2 };
  root.TillCalc = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
