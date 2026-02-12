import { normalizeText } from "./catalogService.js";

const U_ALIASES = {
  units: "unit",
  unit: "unit",
  pcs: "piece",
  pc: "piece",
  piece: "piece",
  pieces: "piece",
  bottle: "bottle",
  bottles: "bottle",
  pack: "pack",
  packs: "pack",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  gram: "g",
  grams: "g",
  g: "g",
  l: "liter",
  litre: "liter",
  liter: "liter",
  litres: "liter",
  liters: "liter",
  ml: "ml"
};

const U_MASS = new Set(["g", "kg"]);
const U_VOL = new Set(["ml", "liter"]);
const U_CNT = new Set(["unit", "piece", "pack", "bottle"]);

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toCanonicalUnit = (unit = "unit") => {
  const key = normalizeText(unit);
  return U_ALIASES[key] || key || "unit";
};

const getUnitGroup = (unit = "unit") => {
  if (U_MASS.has(unit)) return "mass";
  if (U_VOL.has(unit)) return "volume";
  if (U_CNT.has(unit)) return "count";
  return "unknown";
};

const toBaseMeasure = (amount, unit) => {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === "kg") return amount * 1000;
  if (unit === "g") return amount;
  if (unit === "liter") return amount * 1000;
  if (unit === "ml") return amount;
  return null;
};

export const convertQuantity = (amount, fromUnit, toUnit) => {
  const qty = safeNumber(amount, NaN);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const from = toCanonicalUnit(fromUnit);
  const to = toCanonicalUnit(toUnit);
  if (!from || !to) return null;
  if (from === to) return qty;

  const fromGroup = getUnitGroup(from);
  const toGroup = getUnitGroup(to);
  if (fromGroup !== toGroup) return null;

  if (fromGroup === "mass" || fromGroup === "volume") {
    const base = toBaseMeasure(qty, from);
    const oneToBase = toBaseMeasure(1, to);
    if (!base || !oneToBase) return null;
    return base / oneToBase;
  }

  return null;
};

const parseSizeLabel = (sizeLabel = "") => {
  const size = normalizeText(sizeLabel);
  if (!size) return null;

  const multiMatch = size.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l|liter|litre)\b/i);
  if (multiMatch) {
    const amountA = safeNumber(multiMatch[1], NaN);
    const amountB = safeNumber(multiMatch[2], NaN);
    const unit = toCanonicalUnit(multiMatch[3]);
    if (Number.isFinite(amountA) && Number.isFinite(amountB)) {
      return { amount: amountA * amountB, unit, raw: sizeLabel };
    }
  }

  const regularMatch = size.match(
    /^(\d+(?:\.\d+)?)\s*(kg|g|ml|l|liter|litre|pack|packs|piece|pieces|pcs|unit|units|bottle|bottles)\b/i
  );
  if (regularMatch) {
    const amount = safeNumber(regularMatch[1], NaN);
    const unit = toCanonicalUnit(regularMatch[2]);
    if (Number.isFinite(amount)) {
      return { amount, unit, raw: sizeLabel };
    }
  }

  const fingerMatch = size.match(/^(\d+(?:\.\d+)?)\s*[- ]?finger\b/i);
  if (fingerMatch) {
    const amount = safeNumber(fingerMatch[1], NaN);
    if (Number.isFinite(amount)) {
      return { amount, unit: "piece", raw: sizeLabel };
    }
  }

  return null;
};

const roundMoney = (value) => Number(value.toFixed(2));
const roundQuantity = (value) => Number(value.toFixed(4));

export const computePricingSnapshot = ({
  quantity,
  unit = "unit",
  size = "",
  unitPrice
}) => {
  const requestedQty = safeNumber(quantity, 0);
  const pricePerSku = safeNumber(unitPrice, NaN);
  if (!Number.isFinite(requestedQty) || requestedQty <= 0 || !Number.isFinite(pricePerSku) || pricePerSku <= 0) {
    return {
      lineTotalPrice: null,
      billableQuantity: null,
      billableUnit: "",
      pricingMode: "unknown"
    };
  }

  const requestedUnit = toCanonicalUnit(unit);
  const sizeInfo = parseSizeLabel(size);
  if (!sizeInfo) {
    return {
      lineTotalPrice: roundMoney(requestedQty * pricePerSku),
      billableQuantity: requestedQty,
      billableUnit: requestedUnit || "unit",
      pricingMode: "direct"
    };
  }

  const requestedGroup = getUnitGroup(requestedUnit);
  const sizeGroup = getUnitGroup(sizeInfo.unit);

  let billableQuantity = requestedQty;
  let pricingMode = "direct";
  let billableUnit = requestedUnit || "unit";

  if (requestedGroup === sizeGroup && (requestedGroup === "mass" || requestedGroup === "volume")) {
    const requestedBase = toBaseMeasure(requestedQty, requestedUnit);
    const sizeBase = toBaseMeasure(sizeInfo.amount, sizeInfo.unit);

    if (requestedBase && sizeBase) {
      billableQuantity = Math.max(0.0001, requestedBase / sizeBase);
      billableUnit = "pack";
      pricingMode = "prorated";
    }
  } else if (requestedGroup === "count" && sizeGroup === "count") {
    if (requestedUnit === "pack") {
      billableQuantity = requestedQty;
      billableUnit = "pack";
      pricingMode = "direct";
    } else if (sizeInfo.unit === "pack" || sizeInfo.amount > 1) {
      billableQuantity = Math.max(0.0001, requestedQty / sizeInfo.amount);
      billableUnit = "pack";
      pricingMode = "prorated";
    } else {
      billableQuantity = requestedQty;
      billableUnit = requestedUnit;
      pricingMode = "direct";
    }
  } else if (requestedUnit === "pack") {
    billableQuantity = requestedQty;
    billableUnit = "pack";
    pricingMode = "direct";
  } else {
    billableQuantity = requestedQty;
    billableUnit = requestedUnit;
    pricingMode = "direct";
  }

  const normalizedBillableQuantity = roundQuantity(billableQuantity);

  return {
    lineTotalPrice: roundMoney(normalizedBillableQuantity * pricePerSku),
    billableQuantity: normalizedBillableQuantity,
    billableUnit,
    pricingMode
  };
};

export const mergeQuantities = ({ currentQuantity, currentUnit, deltaQuantity, deltaUnit }) => {
  const currentQty = safeNumber(currentQuantity, 0);
  const deltaQty = safeNumber(deltaQuantity, 0);
  const normalizedCurrentUnit = toCanonicalUnit(currentUnit || "unit");
  const normalizedDeltaUnit = toCanonicalUnit(deltaUnit || "unit");

  if (currentQty <= 0) {
    return {
      quantity: deltaQty,
      unit: normalizedDeltaUnit
    };
  }

  if (normalizedCurrentUnit === normalizedDeltaUnit) {
    return {
      quantity: currentQty + deltaQty,
      unit: normalizedCurrentUnit
    };
  }

  const convertedDelta = convertQuantity(deltaQty, normalizedDeltaUnit, normalizedCurrentUnit);
  if (convertedDelta !== null) {
    return {
      quantity: currentQty + convertedDelta,
      unit: normalizedCurrentUnit
    };
  }

  const convertedCurrent = convertQuantity(currentQty, normalizedCurrentUnit, normalizedDeltaUnit);
  if (convertedCurrent !== null) {
    return {
      quantity: convertedCurrent + deltaQty,
      unit: normalizedDeltaUnit
    };
  }

  return {
    quantity: currentQty + deltaQty,
    unit: normalizedCurrentUnit || normalizedDeltaUnit
  };
};

