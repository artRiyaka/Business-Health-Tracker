(function (root) {
  const business = {
    name: "Harbor & Rye",
    kind: "cafe",
    investment: 18000,
    rent: 2800,
    wages: 2400,
    utilities: 420,
    other: 780,
    cost: 1.8,
    price: 5.5,
    units: 1420,
    source: "sample",
  };

  const api = {
    username: "Harbor & Rye",
    business: business,
    kinds: [
      { id: "cafe", label: "Café" },
      { id: "shop", label: "Online shop" },
      { id: "service", label: "Service" },
    ],
  };

  root.TillDemo = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
