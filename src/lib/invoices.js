/* ==========================================================================
   invoices.js — COMPLET (compat app + num FYYYY-MM-XXXXXX + missionEndByQuota)
   ========================================================================== */

/* ==========================================================================
     STORAGE KEYS (compat)
     ========================================================================== */

const INVOICES_KEY = "nodebox_invoices";
const LEAVES_KEY = "fact_leaves_v2";
const LEAVES_LEGACY_KEY = "nodebox_leaves";

/* ==========================================================================
     SMALL HELPERS
     ========================================================================== */

const isISO = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));

// Valider date ISO + vérifier que c'est une date réelle (ex: pas 2025-02-31)
export const isValidDate = (iso) => {
  if (!isISO(iso)) return false;
  const dt = toUTCDate(iso);
  if (isNaN(dt.getTime())) return false;
  // Vérifier que la date n'a pas changé (ex: 2025-02-31 devient 2025-03-03)
  const [y, m, d] = iso.split("-").map(x => Number(x));
  return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === m && dt.getUTCDate() === d;
};

const pad2 = (n) => String(n).padStart(2, "0");

const toUTCDate = (iso) => {
  const [y, m, d] = (iso || "").split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

const fromUTCDate = (dt) => {
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(
    dt.getUTCDate()
  )}`;
};

function isWeekdayDate(d) {
  const day = d.getUTCDay();
  return day !== 0 && day !== 6; // lun-ven
}

/* ==========================================================================
     DATE UTILS
     ========================================================================== */

export function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDaysISO(iso, days) {
  if (!isISO(iso)) return iso;
  const dt = toUTCDate(iso);
  dt.setUTCDate(dt.getUTCDate() + (Number(days) || 0));
  return fromUTCDate(dt);
}

export function endOfMonthISO(iso) {
  if (!isISO(iso)) return iso;
  const dt = toUTCDate(iso);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0));
  return fromUTCDate(last);
}

export function nextWeekdayISO(iso) {
  if (!isISO(iso)) return iso;
  const dt = toUTCDate(iso);
  dt.setUTCDate(dt.getUTCDate() + 1);

  // max 10 itérations
  for (let i = 0; i < 10; i++) {
    if (isWeekdayDate(dt)) break;
    dt.setUTCDate(dt.getUTCDate() + 1);
  }

  return fromUTCDate(dt);
}

/* ==========================================================================
     SETTINGS (compat pages)
     ========================================================================== */

export function loadSettingsLike(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/* ==========================================================================
     INVOICES STORAGE
     ========================================================================== */

export function loadInvoices() {
  try {
    const raw = localStorage.getItem(INVOICES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveInvoices(invoices) {
  localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices || []));
  // Déclencher un événement pour notifier les composants
  window.dispatchEvent(new CustomEvent('invoicesUpdated'));
}

/* ==========================================================================
     LEAVES
     ========================================================================== */

export function loadLeaves() {
  const normalizeLeave = (item) => {
    if (!item || typeof item !== "object") return null;

    const start = String(item.start ?? item.startDate ?? "").trim();
    const end = String(item.end ?? item.endDate ?? "").trim();

    // Valider la date de début (obligatoire)
    if (!isISO(start)) return null;

    // Si pas de date fin, l'assigner à start (congé d'une seule journée)
    const finalEnd = isISO(end) && end ? end : start;

    const normalized = start <= finalEnd ? { ...item, start, end: finalEnd } : { ...item, start: finalEnd, end: start };
    
    // Préserver le nouveau système isHalf (booléen)
    if (item.isHalf !== undefined) {
      normalized.isHalf = Boolean(item.isHalf);
    }
    
    // Migration : convertir ancien startHalf/endHalf en isHalf si c'est une journée unique
    if (!item.isHalf && (item.startHalf || item.endHalf) && normalized.start === normalized.end) {
      normalized.isHalf = true;
    }
    
    return normalized;
  };

  const readLeavesFromStorage = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeLeave).filter(Boolean);
    } catch {
      return [];
    }
  };

  try {
    const current = readLeavesFromStorage(LEAVES_KEY);
    const legacy = readLeavesFromStorage(LEAVES_LEGACY_KEY);

    if (legacy.length === 0) return current;

    const seen = new Set(current.map((l) => `${l.start}|${l.end}|${l.type || ""}|${l.reason || ""}`));
    const merged = [...current];

    for (const leave of legacy) {
      const sig = `${leave.start}|${leave.end}|${leave.type || ""}|${leave.reason || ""}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      merged.push(leave);
    }

    return merged;
  } catch {
    return [];
  }
}

/* ==========================================================================
     MONEY FORMAT
     ========================================================================== */

export function fmtEUR(n) {
  const v = Number(n) || 0;
  const s = v.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const clean = s.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
  return `${clean} €`;
}

/* ==========================================================================
     TOTALS
     ========================================================================== */

export function invoiceHT(inv, defaultTjm) {
  return (inv.items || []).reduce((sum, it) => {
    const qty = Number(it.qty) || 0;
    const pu =
      it.unitPrice === null || it.unitPrice === undefined || it.unitPrice === 0
        ? Number(defaultTjm) || 0
        : Number(it.unitPrice) || 0;
    return sum + qty * pu;
  }, 0);
}

export function invoiceTVA(inv, defaultTjm) {
  if (!inv.vatEnabled) return 0;
  const ht = invoiceHT(inv, defaultTjm);
  const rate = Number(inv.vatRate) || 0;
  return (ht * rate) / 100;
}

export function invoiceTTC(inv, defaultTjm) {
  return invoiceHT(inv, defaultTjm) + invoiceTVA(inv, defaultTjm);
}

/* ==========================================================================
     QUOTA / BC
     ========================================================================== */

export function bcUsedDays(invoices, purchaseOrder) {
  if (!purchaseOrder) return 0;
  const po = String(purchaseOrder || "").trim();
  return (invoices || [])
    .filter((inv) => String(inv.purchaseOrder || "").trim() === po)
    .reduce((sum, inv) => {
      const q = (inv.items || []).reduce(
        (s, it) => s + (Number(it.qty) || 0),
        0
      );
      return sum + q;
    }, 0);
}

export function clampToRemaining(value, remaining) {
  const v = Number(value) || 0;
  const r = Number(remaining);
  if (!Number.isFinite(r)) return v;
  return Math.max(0, Math.min(v, r));
}

/* ==========================================================================
     WORKDAYS
     ========================================================================== */

// safe anti infinite loop
// Fonction pour calculer les jours fériés français pour une année donnée
function getDynamicFrenchHolidays(year) {
  const holidays = [];
  
  // Jours fériés fixes
  holidays.push(`${year}-01-01`); // Jour de l'an
  holidays.push(`${year}-05-01`); // Fête du Travail
  holidays.push(`${year}-05-08`); // Victoire 1945
  holidays.push(`${year}-07-14`); // Bastille
  holidays.push(`${year}-08-15`); // Assomption
  holidays.push(`${year}-11-01`); // Toussaint
  holidays.push(`${year}-11-11`); // Armistice
  holidays.push(`${year}-12-25`); // Noël

  // Jours fériés mobiles basés sur Pâques
  // Calcul de Pâques via l'algorithme de Meeus
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easterDate = new Date(Date.UTC(year, month - 1, day));
  
  // Lundi de Pâques (+1 jour)
  const lundi_paques = new Date(easterDate);
  lundi_paques.setUTCDate(lundi_paques.getUTCDate() + 1);
  holidays.push(`${lundi_paques.getUTCFullYear()}-${String(lundi_paques.getUTCMonth() + 1).padStart(2, '0')}-${String(lundi_paques.getUTCDate()).padStart(2, '0')}`);
  
  // Ascension (+39 jours après Pâques)
  const ascension = new Date(easterDate);
  ascension.setUTCDate(ascension.getUTCDate() + 39);
  holidays.push(`${ascension.getUTCFullYear()}-${String(ascension.getUTCMonth() + 1).padStart(2, '0')}-${String(ascension.getUTCDate()).padStart(2, '0')}`);
  
  // Lundi de Pentecôte (+50 jours après Pâques)
  const pentecote = new Date(easterDate);
  pentecote.setUTCDate(pentecote.getUTCDate() + 50);
  holidays.push(`${pentecote.getUTCFullYear()}-${String(pentecote.getUTCMonth() + 1).padStart(2, '0')}-${String(pentecote.getUTCDate()).padStart(2, '0')}`);

  return holidays;
}

// Cache pour éviter recalcul
const holidaysCache = {};

function isHoliday(iso) {
  if (!isISO(iso)) return false;
  const year = Number(iso.slice(0, 4));
  
  if (!holidaysCache[year]) {
    holidaysCache[year] = getDynamicFrenchHolidays(year);
  }
  
  return holidaysCache[year].includes(iso);
}

function countWeekdaysInclusive(startISO, endISO) {
  if (!isISO(startISO) || !isISO(endISO)) return 0;
  const start = toUTCDate(startISO);
  const end = toUTCDate(endISO);
  if (start.getTime() > end.getTime()) return 0;

  const diff = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (diff > 10000) return 0;

  let count = 0;
  const cur = new Date(start.getTime());
  while (cur.getTime() <= end.getTime()) {
    const isoDate = fromUTCDate(cur)
    // Compter que si c'est un weekday ET pas un jour férié
    if (isWeekdayDate(cur) && !isHoliday(isoDate)) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

export function workedDaysBetween(
  startISO,
  endISO,
  deductLeaves
) {
  if (!isISO(startISO) || !isISO(endISO)) return 0;

  const base = countWeekdaysInclusive(startISO, endISO);
  if (!deductLeaves) return base;

  const leaves = loadLeaves();
  let deducted = 0;

  for (const l of leaves) {
    if (!isISO(l.start) || !isISO(l.end)) continue;

    const overlapStart = l.start > startISO ? l.start : startISO;
    const overlapEnd = l.end < endISO ? l.end : endISO;

    if (overlapStart <= overlapEnd) {
      // Créer une copie du congé avec les dates chevauchées
      const overlapLeave = { ...l, start: overlapStart, end: overlapEnd }
      deducted += getLeaveDaysDeduction(overlapLeave);
    }
  }

  return Math.max(base - deducted, 0);
}

/* ==========================================================================
     ADD N WORKDAYS (with leaves)
     missionEndByQuota uses this
     ========================================================================== */

function isLeaveDay(iso, leaves) {
  for (const l of leaves) {
    if (!isISO(l.start) || !isISO(l.end)) continue;
    if (iso >= l.start && iso <= l.end) {
      return true
    }
  }
  return false
}

/**
 * Calcule les jours ouvrés déductibles pour un congé, en comptant les demi-journées
 */
function getLeaveDaysDeduction(leave) {
  if (!isISO(leave.start)) return 0
  
  const start = toUTCDate(leave.start)
  const end = leave.end ? toUTCDate(leave.end) : start
  
  const diff = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
  if (diff > 10000 || diff < 0) return 0
  
  // Cas 1 : Single day (pas de date fin, ou date fin = date début)
  if (diff === 0 && start.getTime() === end.getTime()) {
    if (!isWeekdayDate(start) || isHoliday(leave.start)) return 0
    // Si demi-journée cochée
    if (leave.isHalf) return 0.5
    // Sinon journée complète
    return 1
  }
  
  // Cas 2 : Multi-day (intervalle du/au)
  // Compter les jours travaillés (weekdays, pas de vacances, pas de jours fériés)
  let count = 0
  const cur = new Date(start.getTime())
  
  while (cur.getTime() <= end.getTime()) {
    const isoDate = fromUTCDate(cur)
    if (isWeekdayDate(cur) && !isHoliday(isoDate)) {
      count += 1
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  
  return Math.max(0, count)
}

/**
 * Add N "worked days" after startISO (weekdays minus leaves).
 * - If startISO is itself a weekday and not leave day, it counts as day 1.
 *   This matches "quota days from mission start" behaviour typically expected.
 */
export function addWorkedDaysISO(
  startISO,
  workdaysToAdd
) {
  if (!isISO(startISO)) return startISO;
  const target = Math.max(0, Math.floor(Number(workdaysToAdd) || 0));
  if (target <= 0) return startISO;

  const leaves = loadLeaves();

  let dt = toUTCDate(startISO);
  let counted = 0;

  // safety guard: max 50000 iterations
  for (let i = 0; i < 50000; i++) {
    const curISO = fromUTCDate(dt);

    const isWorkday = isWeekdayDate(dt) && !isLeaveDay(curISO, leaves);
    if (isWorkday) counted += 1;

    if (counted >= target) return curISO;

    dt.setUTCDate(dt.getUTCDate() + 1);
  }

  // fallback safe
  return fromUTCDate(dt);
}

/**
 * Fin de mission = début + quota jours ouvrés
 * en tenant compte des congés
 */
export function missionEndByQuota(
  missionStartISO,
  quotaWorkdays
) {
  if (!isISO(missionStartISO)) return "";
  const q = Math.max(0, Math.floor(Number(quotaWorkdays) || 0));
  if (q <= 0) return "";
  return addWorkedDaysISO(missionStartISO, q);
}

/* ==========================================================================
     INVOICE NUMBER
     ========================================================================== */

export function nextInvoiceNumber(invoices, year) {
  const y = String(year || new Date().getFullYear());
  const prefix = `FAC-${y}-`;
  let max = 0;

  for (const inv of invoices || []) {
    const n = String(inv.number || "");
    if (!n.startsWith(prefix)) continue;
    const tail = n.slice(prefix.length);
    const k = Number(tail);
    if (Number.isFinite(k)) max = Math.max(max, k);
  }

  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

// FYYYY-MM-XXXXXX (6 derniers chiffres du BC)
function last6DigitsFromBC(bc) {
  const digits = (bc || "").replace(/\D/g, "");
  const last6 = digits.slice(-6);
  return last6.padStart(6, "0");
}

export function makeInvoiceNumberFromDate(bc, isoDate) {
  const yyyy =
    String(isoDate || "").slice(0, 4) || String(new Date().getFullYear());
  const mm =
    String(isoDate || "").slice(5, 7) || pad2(new Date().getMonth() + 1);
  const last6 = last6DigitsFromBC(bc);
  return `F${yyyy}-${mm}-${last6}`;
}

/* ==========================================================================
     ANCIENNES FONCTIONS (compatibilité)
     ========================================================================== */

export const calculateInvoiceTotals = (items, taxRate = 0.2) => {
  const amountHT = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const tva = amountHT * taxRate;
  const amountTTC = amountHT + tva;
  
  return { amountHT, tva, amountTTC };
};

export const getInvoiceById = (id) => {
  return loadInvoices().find((inv) => inv.id === id);
};

export const saveInvoice = (invoice) => {
  const invoices = loadInvoices();
  const index = invoices.findIndex((inv) => inv.id === invoice.id);
  
  if (index >= 0) {
    invoices[index] = invoice;
  } else {
    invoices.push(invoice);
  }
  
  saveInvoices(invoices);
  return invoice;
};

export const deleteInvoice = (id) => {
  const invoices = loadInvoices().filter((inv) => inv.id !== id);
  saveInvoices(invoices);
};

export const getAllInvoices = () => {
  return loadInvoices();
};

export const formatCurrency = (amount) => {
  return fmtEUR(amount);
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
