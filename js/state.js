/* ============================================================
   state.js — app state, persistence, demo data
   ============================================================ */
(function () {
  "use strict";
  const LS_KEY = "lucky-draw-studio-v2";
  const BOOT_KEY = "lucky-draw-studio-boot";

  const DEFAULT_RANGE = { from: 1, to: 1000, digits: 0, preventDuplicates: true, used: [] };
  const CANONICAL_FIELDS = ["code", "name", "phone", "dept"];
  const DEFAULT_FIELD_LABELS = { code: "ID", name: "Name", phone: "Phone", dept: "Department" };
  const DEFAULT_DRAW_FIELDS = ["name"];

  function defineOwn(target, key, value) {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
    return target;
  }

  function copyEnumerable(source) {
    const result = {};
    if (!source || typeof source !== "object") return result;
    Object.keys(source).forEach((key) => defineOwn(result, key, source[key]));
    return result;
  }

  function mergeOwn(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach((key) => defineOwn(target, key, source[key]));
    return target;
  }

  const DEFAULT_SETTINGS = {
    drawMode: "number",           // number | name | participant | range
    removeWinners: true,          // drop winners from future draws
    revealMode: "all",            // all | sequential
    useCountdown: true,
    useConfetti: true,
    useSound: true,
    useMusic: false,
    countdownDuration: 3,         // seconds
    spinDuration: 5,              // seconds
    drawDisplayFields: DEFAULT_DRAW_FIELDS.slice(),
    drawFieldLabels: {},
  };

  const EMPTY_STATE = () => ({
    version: 3,
    event: {
      name: "",
      subtitle: "",
      logo: null,
      theme: "navy",
      bgImage: null,
    },
    settings: {
      ...DEFAULT_SETTINGS,
      numberRange: { from: 1, to: 1000, digits: 0, preventDuplicates: true, used: [] },
      drawDisplayFields: DEFAULT_DRAW_FIELDS.slice(),
      drawFieldLabels: {},
    },
    participants: [],
    prizes: [],
    history: [],
    round: 0,
    selectedPrizeId: null,
    drawDisplayFields: DEFAULT_DRAW_FIELDS.slice(),
  });

  let state = EMPTY_STATE();
  let saveTimer = null;

  /* ---------- deterministic PRNG ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SURNAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Trịnh"];
  const MIDDLE = ["Văn", "Thị", "Đức", "Minh", "Quang", "Hữu", "Xuân", "Tuấn", "Kim", "Thanh", "Công", "Bảo", "Hồng", "Thu", "Ngọc", "Phương", "Lan", "Mai", "Hạnh", "Gia"];
  const FIRST = ["An", "Bình", "Cường", "Dũng", "Đạt", "Hải", "Hiếu", "Hùng", "Huy", "Khánh", "Kiên", "Linh", "Long", "Minh", "Nam", "Ngọc", "Phát", "Phong", "Quân", "Sơn", "Tâm", "Thắng", "Thịnh", "Thu", "Trang", "Tuấn", "Việt", "Vinh", "Vy", "Yến", "Hà", "Lan"];
  const DEPTS = ["Engineering", "Product", "Marketing", "Sales", "Human Resources", "Finance", "Design", "Operations", "Customer Success", "Leadership"];
  const PHONE_PRE = ["090", "091", "092", "093", "094", "096", "097", "098", "036", "037", "038"];

  function randName(rnd, min = 2, max = null) {
    const parts = [SURNAMES[(rnd() * SURNAMES.length) | 0]];
    const mids = 1 + ((rnd() * (max ? max - min : 0)) | 0);
    for (let i = 0; i < Math.max(0, Math.min(mids, MIDDLE.length)); i++) {
      parts.push(MIDDLE[(rnd() * MIDDLE.length) | 0]);
    }
    parts.push(FIRST[(rnd() * FIRST.length) | 0]);
    return parts.join(" ");
  }
  function randPhone(rnd) {
    return PHONE_PRE[(rnd() * PHONE_PRE.length) | 0] + String(((rnd() * 9000000 + 1000000) | 0)).padStart(7, "0");
  }

  function demoEvent() {
    const st = EMPTY_STATE();
    st.event = { name: "TECH FEST 2026", subtitle: "ADVANCE · INNOVATE · INSPIRE", logo: null, theme: "navy", bgImage: null };
    st.settings = { ...DEFAULT_SETTINGS, numberRange: { ...DEFAULT_RANGE }, drawMode: "number", removeWinners: true, revealMode: "sequential", useCountdown: true, useConfetti: true, useSound: true, useMusic: false, drawDisplayFields: ["name", "dept"], drawFieldLabels: {} };
    st.drawDisplayFields = ["name", "dept"];
    const rnd = mulberry32(20260924);
    const count = 100;
    for (let i = 0; i < count; i++) {
      st.participants.push({
        uid: uid(),
        code: String(i + 1).padStart(5, "0"),
        name: randName(rnd, 1, 2),
        phone: randPhone(rnd),
        dept: DEPTS[(rnd() * DEPTS.length) | 0],
        eligible: true,
        excluded: false,
        wins: 0,
        wonPrizes: [],
      });
    }
    const mkPrize = (name, emoji, winnerCount, desc) => ({ uid: uid(), name, emoji, image: null, desc, qty: winnerCount, winnerCount, order: 0, done: false });
    st.prizes = [
      mkPrize("MacBook Air", "💻", 1, "Grand prize of the night — sleek, powerful, unforgettable."),
      mkPrize("iPhone", "📱", 2, "The latest flagship, ready for a new owner."),
      mkPrize("AirPods", "🎧", 5, "Wireless sound for the daily rhythm."),
      mkPrize("Gift Voucher", "🎫", 10, "A voucher to celebrate the festival spirit."),
    ];
    st.prizes.forEach((p, i) => (p.order = i + 1));
    return st;
  }

  function normalizeParticipant(participant) {
    if (!participant || typeof participant !== "object") return null;
    const result = copyEnumerable(participant);
    result.uid = result.uid ? String(result.uid) : uid();
    result.code = String(result.code == null ? "" : result.code);
    result.name = String(result.name == null ? "" : result.name);
    result.phone = String(result.phone == null ? "" : result.phone);
    result.dept = String(result.dept == null ? "" : result.dept);
    result.eligible = result.eligible !== false;
    result.excluded = !!result.excluded;
    result.wins = Number.isFinite(Number(result.wins)) ? Number(result.wins) : 0;
    result.wonPrizes = Array.isArray(result.wonPrizes) ? result.wonPrizes.slice() : [];
    const data = result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data : {};
    result.data = {};
    Object.keys(data).forEach((key) => { defineOwn(result.data, key, String(data[key] == null ? "" : data[key])); });
    return result;
  }

  function normalizeDrawFields(fields, fallback) {
    const values = Array.isArray(fields) ? fields : [];
    const result = [];
    values.forEach((field) => {
      const key = String(field == null ? "" : field).trim();
      if (key && !result.includes(key)) result.push(key);
    });
    if (result.length) return result;
    return Array.isArray(fallback) ? fallback.slice() : DEFAULT_DRAW_FIELDS.slice();
  }

  function normalizeState(parsed) {
    const result = EMPTY_STATE();
    const parsedCopy = copyEnumerable(parsed || {});
    Object.keys(parsedCopy).forEach((key) => defineOwn(result, key, parsedCopy[key]));
    result.settings = mergeOwn(copyEnumerable(DEFAULT_SETTINGS), (parsed && parsed.settings) || {});
    result.settings.numberRange = mergeOwn(copyEnumerable(DEFAULT_RANGE), (parsed && parsed.settings && parsed.settings.numberRange) || {});
    if (!Array.isArray(result.settings.numberRange.used)) result.settings.numberRange.used = [];
    result.event = mergeOwn(copyEnumerable(EMPTY_STATE().event), (parsed && parsed.event) || {});
    const savedFields = parsed && parsed.settings && Object.prototype.hasOwnProperty.call(parsed.settings, "drawDisplayFields")
      ? parsed.settings.drawDisplayFields
      : (parsed && parsed.drawDisplayFields);
    result.drawDisplayFields = normalizeDrawFields(savedFields);
    result.settings.drawDisplayFields = result.drawDisplayFields.slice();
    result.settings.drawFieldLabels = result.settings.drawFieldLabels && typeof result.settings.drawFieldLabels === "object" && !Array.isArray(result.settings.drawFieldLabels)
      ? copyEnumerable(result.settings.drawFieldLabels)
      : {};
    result.participants = (Array.isArray(result.participants) ? result.participants : []).map(normalizeParticipant).filter(Boolean);
    result.prizes = Array.isArray(result.prizes) ? result.prizes : [];
    result.history = Array.isArray(result.history) ? result.history : [];
    result.round = Number.isFinite(Number(result.round)) ? Number(result.round) : 0;
    return result;
  }

  function syncDrawFields() {
    const fields = normalizeDrawFields(state.settings.drawDisplayFields || state.drawDisplayFields);
    state.drawDisplayFields = fields;
    state.settings.drawDisplayFields = fields.slice();
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version >= 2) {
          state = normalizeState(parsed);
          return false;
        }
      }
    } catch (error) {
      state = EMPTY_STATE();
    }
    if (!localStorage.getItem(BOOT_KEY)) {
      state = demoEvent();
      localStorage.setItem(BOOT_KEY, "1");
      save();
      return true;
    }
    state = EMPTY_STATE();
    return false;
  }

  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        syncDrawFields();
        localStorage.setItem(LS_KEY, JSON.stringify(state));
      } catch (error) {
        if (window.LD && LD.app && typeof LD.app.toast === "function") LD.app.toast("Could not save to browser storage (image too large?).", "error");
      }
    }, 120);
  }

  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function nowStamp() { return Date.now(); }

  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function fmtNum(n) { return "#" + String(n).padStart(5, "0"); }

  function isEmptyFieldValue(value) {
    const normalized = String(value == null ? "" : value).trim().toLowerCase();
    return !normalized || normalized === "undefined" || normalized === "null" || normalized === "n/a" || normalized === "-";
  }

  function participantFieldValue(participant, key) {
    if (!participant) return "";
    const field = String(key == null ? "" : key);
    if (CANONICAL_FIELDS.includes(field)) return participant[field] == null ? "" : String(participant[field]).trim();
    const data = participant.data && typeof participant.data === "object" && !Array.isArray(participant.data) ? participant.data : {};
    if (Object.prototype.hasOwnProperty.call(data, field)) return data[field] == null ? "" : String(data[field]).trim();
    if (!Object.prototype.hasOwnProperty.call(participant, field)) return "";
    return participant[field] == null ? "" : String(participant[field]).trim();
  }

  function participantFieldEntries(participant, fields) {
    const keys = Array.isArray(fields) && fields.length ? fields : CANONICAL_FIELDS.concat(participant && participant.data ? Object.keys(participant.data) : []);
    const seen = new Set();
    const entries = [];
    keys.forEach((key) => {
      const normalizedKey = String(key == null ? "" : key);
      if (!normalizedKey || seen.has(normalizedKey)) return;
      const value = participantFieldValue(participant, normalizedKey);
      if (isEmptyFieldValue(value)) return;
      seen.add(normalizedKey);
      entries.push({ key: normalizedKey, value: String(value) });
    });
    return entries;
  }

  function drawDisplayFields() {
    return normalizeDrawFields(state.settings.drawDisplayFields || state.drawDisplayFields);
  }

  function setDrawDisplayFields(fields) {
    const normalized = normalizeDrawFields(fields, []);
    if (!Array.isArray(fields) || !normalized.length) return false;
    state.drawDisplayFields = normalized;
    state.settings.drawDisplayFields = normalized.slice();
    save();
    return true;
  }

  function fieldLabel(key) {
    const labels = state.settings && state.settings.drawFieldLabels ? state.settings.drawFieldLabels : {};
    if (Object.prototype.hasOwnProperty.call(labels, key) && labels[key]) return labels[key];
    return Object.prototype.hasOwnProperty.call(DEFAULT_FIELD_LABELS, key) ? DEFAULT_FIELD_LABELS[key] : key;
  }

  function fieldCatalog(extraColumns) {
    const map = new Map();
    const add = (key, label, canonical) => {
      const normalizedKey = String(key == null ? "" : key).trim();
      if (!normalizedKey) return;
      const previous = map.get(normalizedKey);
      const nextLabel = label == null || label === "" ? (previous ? previous.label : fieldLabel(normalizedKey)) : String(label);
      map.set(normalizedKey, { key: normalizedKey, label: nextLabel, canonical: !!canonical || !!(previous && previous.canonical) });
    };
    CANONICAL_FIELDS.forEach((key) => add(key, fieldLabel(key), true));
    Object.keys(state.settings.drawFieldLabels || {}).forEach((key) => add(key, fieldLabel(key), CANONICAL_FIELDS.includes(key)));
    (Array.isArray(extraColumns) ? extraColumns : []).forEach((column) => {
      if (!column) return;
      add(column.key, column.label || fieldLabel(column.key), column.canonical);
    });
    state.participants.forEach((participant) => {
      const data = participant && participant.data && typeof participant.data === "object" ? participant.data : {};
      Object.keys(data).forEach((key) => add(key, fieldLabel(key), false));
    });
    return Array.from(map.values());
  }

  function setImportFieldMetadata(columns) {
    const labels = copyEnumerable(state.settings.drawFieldLabels || {});
    (Array.isArray(columns) ? columns : []).forEach((column) => {
      if (!column || !column.key) return;
      const label = String(column.label || column.key);
      if (column.canonical && /^Column \d+$/.test(label)) return;
      defineOwn(labels, column.key, label);
    });
    state.settings.drawFieldLabels = labels;
    save();
  }

  /* ---------- derived helpers ---------- */
  function eligiblePool() {
    return state.participants.filter((p) => {
      if (p.excluded) return false;
      if (state.settings.removeWinners && p.wins > 0) return false;
      return true;
    });
  }
  function statusOf(p) {
    if (p.excluded) return "excluded";
    if (p.wins > 0) return "winner";
    return "eligible";
  }
  function winnerTotal() {
    return state.participants.reduce((a, p) => a + p.wins, 0);
  }
  function prizeById(id) {
    return state.prizes.find((p) => p.uid === id);
  }
  // Canonical source of truth for "which prize is being drawn next".
  // The prize object is always DERIVED from the id via prizeById — never stored separately.
  function selectedPrizeId() { return state.selectedPrizeId || null; }
  function selectedPrize() { return selectedPrizeId() ? prizeById(selectedPrizeId()) : null; }
  function setSelectedPrize(uid) {
    state.selectedPrizeId = uid || null;
    save();
  }

  /* ---------- number range helpers ---------- */
  function numberRange() { return state.settings.numberRange || DEFAULT_RANGE; }
  function rangeBounds() {
    const nr = numberRange();
    const from = Math.max(0, parseInt(nr.from, 10) || 0);
    const to = parseInt(nr.to, 10);
    return { from, to, total: to > from ? to - from + 1 : 0, ok: isFinite(to) && to > from };
  }
  function rangeUsed() { return numberRange().used.slice(); }
  function rangeRemaining() {
    const b = rangeBounds();
    return b.ok ? Math.max(0, b.total - numberRange().used.length) : 0;
  }
  function fmtNumber(n, digits) {
    const d = parseInt(digits, 10);
    return d && d > 0 ? String(n).padStart(d, "0") : String(n);
  }
  // Pick `count` random integers inside the configured range.
  // Unique mode: never repeats a drawn number (bounded work; no giant arrays).
  function drawRangeNumbers(count) {
    const b = rangeBounds();
    if (!b.ok || count < 1) return null;
    const nr = numberRange();
    const uniq = !!nr.preventDuplicates;
    if (uniq) {
      const skip = new Set(nr.used || []);
      if (b.total - skip.size < count) return null;
      const out = [];
      if (b.total <= 200000) {
        const pool = [];
        for (let v = b.from; v <= b.to; v++) if (!skip.has(v)) pool.push(v);
        for (let i = 0; i < count && i < pool.length; i++) {
          const j = i + ((Math.random() * (pool.length - i)) | 0);
          const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
          out.push(pool[i]);
        }
        return out;
      }
      let guard = 0;
      while (out.length < count && guard++ < 40000) {
        const v = b.from + ((Math.random() * b.total) | 0);
        if (!skip.has(v)) { out.push(v); skip.add(v); }
      }
      for (let v = b.from; v <= b.to && out.length < count; v++) if (!skip.has(v)) out.push(v);
      return out;
    }
    const out = [];
    for (let i = 0; i < count; i++) out.push(b.from + ((Math.random() * b.total) | 0));
    return out;
  }
  function markRangeUsed(numbers) {
    const nr = numberRange();
    nr.used = nr.used || [];
    numbers.forEach((n) => { if (!nr.used.includes(n)) nr.used.push(n); });
    save();
  }
  function setRangeConfig(patch) {
    if (!state.settings.numberRange) state.settings.numberRange = Object.assign({}, DEFAULT_RANGE);
    const nr = numberRange();
    Object.assign(nr, patch);
    if (nr.used && nr.used.length > rangeBounds().total) nr.used = nr.used.slice(0, rangeBounds().total);
    if (!Array.isArray(nr.used)) nr.used = [];
    save();
  }
  function resetRangeUsed() {
    numberRange().used = [];
    save();
  }

  /* ---------- actions ---------- */
  function addParticipant(pt) {
    const participant = normalizeParticipant(pt);
    if (participant) state.participants.push(participant);
    save();
  }
  function updateParticipant(uid_, patch) {
    const p = state.participants.find((x) => x.uid === uid_);
    if (p) { Object.assign(p, patch); save(); }
  }
  function removeParticipant(uid_) {
    state.participants = state.participants.filter((x) => x.uid !== uid_);
    save();
  }
  function codeExists(code, ignoreUid) {
    return state.participants.some((p) => p.code === code && p.uid !== ignoreUid);
  }
  function addPrize(p) {
    p.order = state.prizes.length + 1;
    state.prizes.push(p);
    save();
  }
  function updatePrize(uid_, patch) {
    const p = state.prizes.find((x) => x.uid === uid_);
    if (p) { Object.assign(p, patch); save(); }
  }
  function removePrize(uid_) {
    state.prizes = state.prizes.filter((x) => x.uid !== uid_);
    state.prizes.forEach((p, i) => (p.order = i + 1));
    if (state.selectedPrizeId === uid_) state.selectedPrizeId = null;
    save();
  }
  function movePrize(uid_, dir) {
    const i = state.prizes.findIndex((x) => x.uid === uid_);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= state.prizes.length) return;
    const tmp = state.prizes[i];
    state.prizes[i] = state.prizes[j];
    state.prizes[j] = tmp;
    state.prizes.forEach((p, k) => (p.order = k + 1));
    save();
  }
  function reorderPrize(fromUid, toUid) {
    const from = state.prizes.findIndex((x) => x.uid === fromUid);
    const to = state.prizes.findIndex((x) => x.uid === toUid);
    if (from < 0 || to < 0 || from === to) return;
    const [item] = state.prizes.splice(from, 1);
    state.prizes.splice(to, 0, item);
    state.prizes.forEach((p, k) => (p.order = k + 1));
    save();
  }

  function registerWinners(prize, winners, opts) {
    state.round += 1;
    const entry = {
      uid: uid(),
      time: nowStamp(),
      round: state.round,
      kind: "participant",
      prize: { uid: prize.uid, name: prize.name, emoji: prize.emoji, image: prize.image },
      displayFields: opts && Array.isArray(opts.displayFields) ? opts.displayFields.slice() : ["code", "name", "dept"],
      winners: winners.map((w) => {
        const winner = { code: w.code, name: w.name, dept: w.dept, phone: w.phone, data: copyEnumerable(w.data || {}) };
        return winner;
      }),
    };
    state.history.push(entry);
    for (const w of winners) {
      const p = state.participants.find((x) => x.uid === w.uid);
      if (p) {
        p.wins += 1;
        p.wonPrizes = p.wonPrizes || [];
        p.wonPrizes.push(prize.uid);
        if (opts && opts.removeWinners) p.eligible = false;
      }
    }
    const pr = state.prizes.find((x) => x.uid === prize.uid);
    if (pr && pr.qty) {
      pr.qty = Math.max(0, pr.qty - 1);
      if (pr.qty === 0) {
        pr.done = true;
        if (state.selectedPrizeId === pr.uid) state.selectedPrizeId = null;
      }
    }
    save();
    return entry;
  }

  function registerNumberDraw(prize, numbers, opts) {
    state.round += 1;
    const entry = {
      uid: uid(),
      time: nowStamp(),
      round: state.round,
      kind: "number",
      prize: prize ? { uid: prize.uid, name: prize.name, emoji: prize.emoji, image: prize.image } : { uid: null, name: "Lucky Draw", emoji: "🎱", image: null },
      numbers: numbers.slice(),
      from: opts && opts.from != null ? opts.from : null,
      to: opts && opts.to != null ? opts.to : null,
      digits: opts && opts.digits != null ? opts.digits : 0,
      winners: [],
    };
    state.history.push(entry);
    if (opts && opts.markUsed !== false) markRangeUsed(numbers);
    if (prize && prize.uid) {
      const pr = state.prizes.find((x) => x.uid === prize.uid);
      if (pr && pr.qty) {
        pr.qty = Math.max(0, pr.qty - 1);
        if (pr.qty === 0) {
          pr.done = true;
          if (state.selectedPrizeId === pr.uid) state.selectedPrizeId = null;
        }
      }
    }
    save();
    return entry;
  }

  function markPrizeDone(uid_, done) {
    const p = state.prizes.find((x) => x.uid === uid_);
    if (p) {
      p.done = !!done;
      if (done && state.selectedPrizeId === p.uid) state.selectedPrizeId = null;
      save();
    }
  }

  function resetGame() {
    for (const p of state.participants) {
      p.eligible = true;
      p.excluded = false;
      p.wins = 0;
      p.wonPrizes = [];
    }
    state.history = [];
    state.round = 0;
    for (const p of state.prizes) {
      p.done = false;
      p.qty = p.winnerCount;
    }
    numberRange().used = [];
    save();
  }

  function clearAll() {
    state = EMPTY_STATE();
    localStorage.setItem(BOOT_KEY, "1");
    save();
  }

  window.LD = Object.assign(window.LD || {}, {
    getState: () => state,
    defaults: DEFAULT_SETTINGS,
    load, save, uid, nowStamp, fmtTime,
    eligiblePool, statusOf, winnerTotal, prizeById,
    isEmptyFieldValue, participantFieldValue, participantFieldEntries,
    drawDisplayFields, setDrawDisplayFields, fieldLabel, fieldCatalog, setImportFieldMetadata,
    selectedPrizeId, selectedPrize, setSelectedPrize,
    numberRange, rangeBounds, rangeUsed, rangeRemaining, fmtNumber, drawRangeNumbers,
    markRangeUsed, setRangeConfig, resetRangeUsed,
    addParticipant, updateParticipant, removeParticipant, codeExists,
    addPrize, updatePrize, removePrize, movePrize, reorderPrize,
    registerWinners, registerNumberDraw, markPrizeDone,
    resetGame, clearAll,
    demoEvent, mulberry32,
    LS_KEY, BOOT_KEY,
  });
  // live accessor (Object.assign above would flatten a getter into a stale data property)
  Object.defineProperty(window.LD, "state", {
    get() { return state; },
    set(v) { state = v; },
    enumerable: true,
    configurable: true,
  });
})();