/* ============================================================
   draw.js — draw engine + presentation stage
   ============================================================ */
(function () {
  "use strict";

  const draw = {
    el: {},         // DOM refs
    session: null,  // active draw session
    status: "idle", // idle ready countdown spinning slowing revealing completed
    timers: [],
    prizeUid: null, // selected prize (persists between sessions)
    count: 1,
    _busy: false,

/* ---------------- init / refs ---------------- */
    init() {
      // prizeUid is a live mirror of state.selectedPrizeId — the single canonical
      // selection source. Reads derive from state; writes persist through it.
      Object.defineProperty(this, "prizeUid", {
        get() { return LD.selectedPrizeId(); },
        set(v) { LD.setSelectedPrize(v); },
        enumerable: true,
        configurable: true,
      });
      const $ = (id) => document.getElementById(id);
      const e = this.el;
      ["stage","stageEvent","stageEventSub","stageLogo","stageLogoFallback","stageRound",
       "prizeImg","prizeKicker","prizeName","prizeMeta","rollViewport","rollMain","rollSub","rollTag","rollGrid",
       "statusText","statusLine","stageCta","stageExit","stageFull","stageSound",
        "countOverlay","countNum","countWord","revealOverlay","revealCard","revealCode","revealName","revealFields",
       "revealPrizeImg","revealPrizeName","revealRound","revealNext","revealGrid","revealNextLabel",
"gridOverlay","gridPrizeName","gridCards","gridNext",
       "opPrize","opCount","opMinus","opPlus","opReveal","opEligible","opWinners","opRound",
       "opEligibleLbl","opWinnersLbl","opRoundLbl",
       "opSound","opMusic","opFullscreen","operatorBar",
       "stateChip","stageCallout","scIcon","scTitle","scDesc","scCta",
       "rangeBar","rgPreset","rgFrom","rgTo","rgFormat","rgUnique","rgUsed","rgMeta","rgReset"]
        .forEach((id) => (e[id] = $(id)));

      this.el.stageCta.addEventListener("click", () => this.onCta());
      this.el.stageExit.addEventListener("click", () => LD.app.goto("home"));
      this.el.stageFull.addEventListener("click", () => LD.app.togglePresentation());
      this.el.stageSound.addEventListener("click", () => {
        const v = LD.audio.on;
        LD.audio.setSound(!v);
        LD.app.syncSoundIcons();
      });
      this.el.revealNext.addEventListener("click", () => this.onRevealNext());
      this.el.revealGrid.addEventListener("click", () => this.showGrid());
      this.el.gridNext.addEventListener("click", () => this.onGridNext());

      this.el.opPrize.addEventListener("change", () => { this.setPrize(this.el.opPrize.value, null, true); });
      this.el.opReveal.addEventListener("change", () => { LD.state.settings.revealMode = this.el.opReveal.value; LD.save(); });
      this.el.opMinus.addEventListener("click", () => this.stepCount(-1));
      this.el.opPlus.addEventListener("click", () => this.stepCount(1));
      this.el.opCount.addEventListener("change", () => this.setCount(parseInt(this.el.opCount.value, 10) || 1));
      this.el.opFullscreen.addEventListener("click", () => LD.app.togglePresentation());
      this.el.opSound.addEventListener("click", () => {
        const v = LD.audio.on;
        LD.audio.setSound(!v);
        LD.app.syncSoundIcons();
      });
      this.el.opMusic.addEventListener("click", () => this.toggleMusic());

      const d = this.el;
      d.rgPreset.addEventListener("change", () => {
        const v = d.rgPreset.value;
        if (v && v !== "custom") {
          const parts = v.split(",");
          d.rgFrom.value = parts[0];
          d.rgTo.value = parts[1];
        }
        this.commitRange();
      });
      d.rgFrom.addEventListener("change", () => this.commitRange());
      d.rgTo.addEventListener("change", () => this.commitRange());
      d.rgFormat.addEventListener("change", () => this.commitRange());
      d.rgUnique.addEventListener("change", () => this.commitRange());
      d.rgReset.addEventListener("click", () => this.resetRange());

this.mousemoveTimer = null;
      this.FLOAT_HIDE_MS = 2000;
      const keepActive = () => {
        if (!document.body.classList.contains("presentation")) return;
        document.body.classList.add("mouse-active");
        clearTimeout(this.mousemoveTimer);
        this.mousemoveTimer = setTimeout(() => document.body.classList.remove("mouse-active"), this.FLOAT_HIDE_MS);
      };
      const scheduleHide = () => {
        if (!document.body.classList.contains("presentation")) return;
        clearTimeout(this.mousemoveTimer);
        this.mousemoveTimer = setTimeout(() => document.body.classList.remove("mouse-active"), this.FLOAT_HIDE_MS);
      };
      document.addEventListener("mousemove", keepActive);
      const rbar = this.el.operatorBar;
      if (rbar) {
        rbar.addEventListener("pointerenter", () => {
          if (!document.body.classList.contains("presentation")) return;
          document.body.classList.add("mouse-active");
          clearTimeout(this.mousemoveTimer);
        });
        rbar.addEventListener("pointerleave", scheduleHide);
      }
      document.addEventListener("touchstart", () => {
        if (document.body.classList.contains("presentation")) document.body.classList.add("mouse-active");
      });
    },

    toggleMusic() {
      if (!LD.audio.isMusicPlaying()) {
        if (LD.audio.playMusic()) { LD.app.toast("Background music on"); }
        else {
          LD.audio.pickMusic().then((f) => {
            if (f) LD.app.toast("Music loaded: " + f.name, "success");
            else LD.app.toast("Pick an audio file to enable background music", "warn");
          });
        }
      } else { LD.audio.stopMusic(); LD.app.toast("Music off"); }
      LD.app.syncMusicIcons();
    },

    /* ---------------- refresh stage ---------------- */
    refresh() {
      const S = LD.getState();
      this.el.stageEvent.textContent = S.event.name || "YOUR EVENT";
      this.el.stageEventSub.textContent = S.event.subtitle || "LUCKY DRAW";
      this.el.stageRound.textContent = String(S.round + (this.isLive() ? 1 : 0)).padStart(2, "0");
      if (S.event.logo) { this.el.stageLogo.src = S.event.logo; this.el.stageLogo.hidden = false; this.el.stageLogoFallback.hidden = true; }
      else { this.el.stageLogo.hidden = true; this.el.stageLogoFallback.hidden = false; this.el.stageLogoFallback.textContent = "🎯"; }
      const bg = document.getElementById("stageBgImage");
      bg.style.backgroundImage = S.event.bgImage ? `url("${S.event.bgImage}")` : "";
      if (S.event.bgImage) bg.style.opacity = "";

 this.syncPrizeSelectors();
      if (this.el.opReveal) this.el.opReveal.value = S.settings.revealMode;
      this.syncRangeUI();
      this.syncStats();
      this.refreshStage();
    },

    syncPrizeSelectors() {
      const S = LD.getState();
      const opts = S.prizes.slice().sort((a, b) => a.order - b.order);
      const html = opts
        .map((p) => `<option value="${p.uid}"${p.done ? " disabled" : ""}>${p.done ? "✓ done — " : ""}${p.name} (${p.winnerCount}×)</option>`)
        .join("");
      this.el.opPrize.innerHTML = `<option value="">— Select prize —</option>` + html;
      const home = document.getElementById("homePrizeSelect");
      if (home) home.innerHTML = this.el.opPrize.innerHTML;
      if (this.el.opPrize.value !== (this.prizeUid || "")) this.el.opPrize.value = this.prizeUid || "";
      if (home) home.value = this.prizeUid || "";
    },

    syncStats() {
      const S = LD.getState();
      const pool = LD.eligiblePool();
      document.getElementById("opEligible").textContent = pool.length;
      document.getElementById("opWinners").textContent = LD.winnerTotal();
document.getElementById("opRound").textContent = S.round;
      this.el.opRoundLbl.textContent = "draw";

      const nb = document.getElementById("navPartBadge");
      if (nb) nb.textContent = S.participants.length;
      document.getElementById("navPrizeBadge").textContent = S.prizes.length;
      document.getElementById("navHistoryBadge").textContent = S.history.length;

      if (this.inRangeMode()) {
        const used = LD.rangeUsed().length;
        const b = LD.rangeBounds();
        const avail = b.ok ? Math.max(0, b.total - used) : 0;
        document.getElementById("opEligible").textContent = b.ok ? avail : "—";
        document.getElementById("opWinners").textContent = used;
        this.el.opEligibleLbl.textContent = "available";
        this.el.opWinnersLbl.textContent = "drawn";
      } else {
        this.el.opEligibleLbl.textContent = "eligible";
        this.el.opWinnersLbl.textContent = "winners";
      }
    },

    /* ---------------- number range helpers ---------------- */
    inRangeMode() { return LD.state.settings.drawMode === "range"; },

    commitRange() {
      const d = this.el;
      const from = parseInt(d.rgFrom.value, 10);
      const to = parseInt(d.rgTo.value, 10);
      const digits = parseInt(d.rgFormat.value, 10) || 0;
      const uniq = d.rgUnique.checked;
      if (!Number.isInteger(from) || from < 0 || !Number.isInteger(to) || !(to > from)) {
        LD.app.toast("Range invalid — From must be 0+ and below To", "error");
        this.syncRangeUI();
        this.refreshStage();
        return;
      }
      LD.setRangeConfig({ from, to, digits, preventDuplicates: uniq });
      this.setCount(this.count);
      this.syncRangeUI();
      this.refreshStage();
      this.syncStats();
    },

    resetRange() {
      if (this.isLive()) { LD.app.toast("Stop the draw first", "warn"); return; }
      LD.resetRangeUsed();
      this.syncRangeUI();
      this.refreshStage();
      this.syncStats();
      this.renderRollIdle();
      LD.app.toast("Number range reset — all numbers available again (R)", "success");
    },

    syncRangeUI() {
      const bar = this.el.rangeBar;
      if (!bar) return;
      const on = this.inRangeMode();
      bar.hidden = !on;
      if (!on) return;
      const nr = LD.numberRange();
      const b = LD.rangeBounds();
      const used = (nr.used || []).length;
      const avail = b.ok ? Math.max(0, b.total - used) : 0;
      this.el.rgFrom.value = b.from;
      this.el.rgTo.value = b.to;
      this.el.rgFormat.value = String(nr.digits || 0);
      this.el.rgUnique.checked = !!nr.preventDuplicates;
      const presets = ["1,10", "1,100", "1,500", "1,1000", "1,5000", "1,10000"];
      this.el.rgPreset.value = b.ok && presets.includes(b.from + "," + b.to) ? b.from + "," + b.to : "custom";
      if (this.el.rgUsed) this.el.rgUsed.textContent = used;
      if (this.el.rgMeta) this.el.rgMeta.textContent = b.ok
        ? nr.preventDuplicates ? `${avail} AVAILABLE · ${used} DRAWN` : `${b.total} AVAILABLE`
        : "Invalid range";
    },

    /* Highest winner count a prize still allows (never exceeds remaining prize qty). */
    prizeCap(p) {
      if (!p) return 99;
      const wc = p.winnerCount || 99;
      const qty = (p.qty != null && p.qty > 0) ? p.qty : wc;
      return Math.max(1, Math.min(wc, qty));
    },

    setPrize(uid, keepCount, silent) {
      this.prizeUid = uid || null;
      const home = document.getElementById("homePrizeSelect");
      if (home) home.value = uid || "";
      if (this.el.opPrize.value !== uid) this.el.opPrize.value = uid || "";
const pr = LD.prizeById(uid);
      if (pr) {
        let minCount = this.prizeCap(pr);
        if (!this.inRangeMode()) minCount = Math.min(minCount, LD.eligiblePool().length);
        if (!keepCount || !this.count || this.count > minCount) this.count = Math.max(1, minCount);
      }
      this.el.opCount.value = this.count;
      document.getElementById("homeCount").value = this.count;
      if (this.status === "completed") this.status = "ready";
      this.refreshStage();
    },

setCount(n) {
      n = Math.max(1, Math.min(99, n | 0));
      if (this.inRangeMode()) {
        const nr = LD.numberRange();
        if (nr.preventDuplicates) {
          const b = LD.rangeBounds();
          if (b.ok) {
            const room = Math.max(0, b.total - (nr.used || []).length);
            if (n > room) n = Math.max(1, room);
          }
        }
      } else {
        const pool = LD.eligiblePool();
        if (n > pool.length) n = Math.max(1, pool.length);
      }
      const pr = this.prizeUid ? LD.prizeById(this.prizeUid) : null;
      if (n > this.prizeCap(pr)) n = Math.max(1, this.prizeCap(pr));
      this.count = n;
      this.el.opCount.value = n;
      document.getElementById("homeCount").value = n;
      this.refreshStage();
    },
    stepCount(d) { this.setCount(this.count + d); },

    isLive() { return ["countdown", "spinning", "slowing", "revealing"].includes(this.status); },

    /* ---------------- stage presentation ---------------- */
refreshStage() {
      const S = LD.getState();
      const pr = this.prizeUid ? LD.prizeById(this.prizeUid) : null;
      const pool = LD.eligiblePool();
      const stage = this.el.stage;
      const rangeMode = this.inRangeMode();
      const b = LD.rangeBounds();
      const used = (LD.numberRange().used || []).length;
      const avail = b.ok ? Math.max(0, b.total - used) : 0;

      stage.dataset.status = this.status;
      stage.dataset.kind = rangeMode ? "range" : "participant";
      document.body.classList.toggle("draw-live", this.isLive());

      if (rangeMode) {
        this.el.prizeKicker.textContent = pr ? "CURRENT PRIZE" : "NUMBER RANGE";
        this.el.prizeName.textContent = pr ? pr.name : (b.ok ? `${LD.fmtNumber(b.from, LD.numberRange().digits || 0)} — ${LD.fmtNumber(b.to, LD.numberRange().digits || 0)}` : "Configure range");
        this.el.prizeImg.innerHTML = pr ? (pr.image ? `<img src="${pr.image}" alt=""/>` : pr.emoji || "🎁") : "🎱";
        this.el.prizeMeta.textContent = `${this.count} winner${this.count > 1 ? "s" : ""} · ${avail} available`;
      } else if (pr) {
        this.el.prizeKicker.textContent = this.prizeLabel(pr);
        this.el.prizeName.textContent = pr.name;
        this.el.prizeImg.innerHTML = pr.image ? `<img src="${pr.image}" alt=""/>` : pr.emoji || "🎁";
        this.el.prizeMeta.textContent = `${this.count} winner${this.count > 1 ? "s" : ""} · ${pool.length} eligible`;
      } else {
        this.el.prizeKicker.textContent = "SELECT A PRIZE";
        this.el.prizeName.textContent = S.prizes.length ? "Pick a prize to begin" : "No prizes configured yet";
        this.el.prizeImg.innerHTML = "🎁";
        this.el.prizeMeta.textContent = pool.length ? `${pool.length} eligible` : "0 eligible";
      }

      const cta = this.el.stageCta;
      const ctaLabel = cta.querySelector(".cta-label");
      if (["countdown", "spinning", "slowing"].includes(this.status)) {
        cta.textContent = "";
        cta.innerHTML = "";
        cta.classList.add("warn");
        cta.disabled = false;
        cta.innerHTML = `<svg><use href="#i-stop"/></svg><span class="cta-label">STOP</span>`;
      } else if (this.status === "idle" || this.status === "ready" || this.status === "completed" || this.status === "error") {
        cta.classList.remove("warn", "live");
        cta.innerHTML = `<svg><use href="#i-play"/></svg><span class="cta-label">${this.status === "completed" ? "START NEXT DRAW" : "START DRAW"}</span>`;
        let valid;
        if (rangeMode) {
          valid = b.ok && (!LD.numberRange().preventDuplicates || avail >= this.count);
        } else {
          valid = pr && pool.length;
        }
        cta.disabled = !valid;
      }

// status line
      const st = this.statusTextMsg(pr, pool, S);
      this.el.statusText.textContent = st;

      this.renderStateChip();
      this.renderCallout(pr, pool, S);
    },

    renderStateChip() {
      const chip = this.el.stateChip;
      const map = {
        idle: ["IDLE", "idle"],
        ready: ["READY", "ready"],
        countdown: ["COUNTDOWN", "countdown"],
        spinning: ["SPINNING", "spinning"],
        slowing: ["SETTLING", "slowing"],
        revealing: ["REVEAL", "revealing"],
        completed: ["COMPLETE", "completed"],
        error: ["ERROR", "error"],
      };
      const [label, key] = map[this.status] || ["IDLE", "idle"];
      chip.hidden = false;
      chip.textContent = label;
      chip.className = "state-chip state-" + key;
    },

    renderCallout(pr, pool, S) {
      const co = this.el.stageCallout;
      let msg = null;
      const rangeMode = this.inRangeMode();
      // When a draw completes the last prize, selection is cleared — surface the
      // "This prize is complete" state from the most recently drawn prize too.
      let lastDeepDone = false;
      if (!pr) {
        const last = S.history[S.history.length - 1];
        const lp = last && last.prize && last.prize.uid ? LD.prizeById(last.prize.uid) : null;
        if (lp && lp.done) lastDeepDone = true;
      }
      if (rangeMode) {
        const b = LD.rangeBounds();
        const nr = LD.numberRange();
        const used = (nr.used || []).length;
        const avail = b.ok ? Math.max(0, b.total - used) : 0;
        if (!b.ok) {
          msg = { icon: "🎱", title: "Invalid number range", desc: "From must be 0 or greater and below To. Open Settings to fix it.", cta: "Open settings", action: "settings" };
        } else if (nr.preventDuplicates && used >= b.total) {
          msg = { icon: "🎉", title: "All numbers have been drawn", desc: "Reset the used list to make every number eligible again.", cta: "Reset range", action: "reset" };
        } else if (nr.preventDuplicates && avail < this.count) {
          msg = { icon: "🎱", title: "Not enough numbers left", desc: `Only ${avail} number${avail === 1 ? "" : "s"} remain for ${this.count} winner${this.count > 1 ? "s" : ""} — reset the range.`, cta: "Reset range", action: "reset" };
        } else if ((pr && pr.done) || lastDeepDone) {
          msg = { icon: "🎯", title: "This prize is complete", desc: "Choose the next prize from the ladder to keep drawing.", cta: "Select next prize", action: "select-prize" };
        }
      } else if (!S.participants.length) {
        msg = { icon: "👥", title: "No participants yet", desc: "Import a CSV or generate the demo roster, then come back and hit START.", cta: "Add participants", view: "participants" };
      } else if ((pr && pr.done) || lastDeepDone) {
        msg = { icon: "🎯", title: "This prize is complete", desc: "Choose the next prize from the ladder to keep drawing.", cta: "Select next prize", action: "select-prize" };
      } else if (!pr) {
        msg = S.prizes.length
          ? { icon: "🎯", title: "No prize selected", desc: "Choose which prize the next draw is for before going live.", cta: "Select next prize", action: "select-prize" }
          : { icon: "🎁", title: "No prizes configured", desc: "Add a prize (or load the demo event) to enable the draw.", cta: "Add a prize", view: "prizes" };
      } else if (!pool.length) {
        msg = { icon: "🎉", title: "Everyone has won already", desc: "Reset the game to make every participant eligible again.", cta: "Manage participants", view: "participants" };
      }
      if (msg && !this.isLive()) {
        co.hidden = false;
        this.el.scIcon.textContent = msg.icon;
        this.el.scTitle.textContent = msg.title;
        this.el.scDesc.textContent = msg.desc;
        this.el.scCta.textContent = msg.cta;
        if (msg.view) this.el.scCta.dataset.goto = msg.view;
        else this.el.scCta.removeAttribute("data-goto");
        this.el.scCta.onclick = null;
        if (msg.action === "settings") this.el.scCta.onclick = () => LD.views.openSettings();
        else if (msg.action === "reset") this.el.scCta.onclick = () => this.resetRange();
        else if (msg.action === "select-prize") this.el.scCta.onclick = () => LD.views.openPrizeSelect();
        this.el.rollViewport.hidden = true;
        this.el.rollGrid.hidden = true;
      } else {
        co.hidden = true;
        if (this.el.rollGrid.hidden !== false) this.el.rollViewport.hidden = false;
      }
    },

    prizeLabel(pr) {
      const tier = ["SPECIAL PRIZE", "FIRST PRIZE", "SECOND PRIZE", "THIRD PRIZE", "CONSOLATION PRIZE"];
      return tier[pr.order - 1] || "PRIZE";
    },

statusTextMsg(pr, pool, S) {
      if (this.inRangeMode()) {
        const b = LD.rangeBounds();
        const nr = LD.numberRange();
        const used = (nr.used || []).length;
        if (!b.ok) return "Range invalid — set From below To in Settings";
        const avail = Math.max(0, b.total - used);
        if (this.status === "completed") return "Draw complete — press START DRAW to draw again";
        if (nr.preventDuplicates && used >= b.total) return "All numbers have been drawn — reset the range (R)";
        if (nr.preventDuplicates && avail < this.count) return `Only ${avail} number${avail === 1 ? "" : "s"} left for ${this.count} winner${this.count > 1 ? "s" : ""}`;
        if (pr && pr.done) return "This prize is complete — pick another";
        if (this.status === "ready" || this.status === "idle") return pr ? "READY TO DRAW" : "READY TO DRAW · PRIZE OPTIONAL";
        if (this.status === "countdown") return "Get ready…";
        if (this.status === "spinning" || this.status === "slowing") return "Rolling numbers…";
        if (this.status === "revealing") return "";
        return "NUMBER RANGE";
      }
      if (!S.participants.length) return "No participants — import a list first";
      if (!pr) return S.prizes.length ? "Select a prize to enable the draw" : "No prizes configured — add one to begin";
      if (!pool.length) return S.settings.removeWinners ? "All participants have already won 🎉" : "No eligible participants available";
      if (this.status === "completed") return "Draw complete — press START DRAW to draw again";
      if (this.status === "ready" || this.status === "idle") return pr.done ? "This prize is complete — pick another" : "Ready — press START DRAW";
      if (this.status === "countdown") return "Get ready…";
      if (this.status === "spinning" || this.status === "slowing") return "Shuffling participants…";
      if (this.status === "revealing") return "";
      return "LUCKY DRAW";
    },

    /* ---------------- main controls ---------------- */
    onCta() {
      if (["countdown", "spinning", "slowing"].includes(this.status)) return this.stopDraw();
      if (this.status === "completed") { this.startNewDraw(); return; }
      this.startDraw();
    },

startDraw() { if (this._busy) return;
      if (this.inRangeMode()) return this.startRangeDraw();
      const S = LD.getState();
      const pool = LD.eligiblePool();
      const pr = this.prizeUid ? LD.prizeById(this.prizeUid) : null;

      if (!pr) { LD.app.toast("Select a prize first", "warn"); LD.app.goto("prizes"); return; }
      if (pr.done) { LD.app.toast("This prize is complete. Pick another one.", "warn"); return; }
      if (!pool.length) {
        this.status = "error";
        LD.app.toast(S.settings.removeWinners ? "Everyone has already won!" : "No eligible participants", "error");
        this.refreshStage();
        return;
      }

      let count = Math.min(this.count, pool.length, pr ? this.prizeCap(pr) : 99);
      if (count < 1) count = 1;
      this.count = count;

      const winners = this.shuffle(pool.slice()).slice(0, count);
      this.session = {
        prize: { uid: pr.uid, name: pr.name, emoji: pr.emoji, image: pr.image, winnerCount: pr.winnerCount },
        count,
        pool,
        winners,
        displayFields: ["name", "participant"].includes(S.settings.drawMode) ? LD.drawDisplayFields().slice() : null,
        winnersShown: 0,
        seq: S.settings.revealMode === "sequential" && count > 1,
        registered: false,
      };
      this._busy = true;

      if (S.settings.useCountdown) {
        this.status = "countdown";
        this.refreshStage();
        this.countdown(() => this.beginSpin());
      } else {
        this.beginSpin();
      }
    },

    startRangeDraw() {
      const S = LD.getState();
      const b = LD.rangeBounds();
      const nr = LD.numberRange();
      const used = (nr.used || []).length;
      const avail = b.ok ? Math.max(0, b.total - used) : 0;
      const pr = this.prizeUid ? LD.prizeById(this.prizeUid) : null;

      if (!b.ok) { this.status = "error"; LD.app.toast("Range invalid — set From below To in Settings", "error"); this.refreshStage(); return; }
      if (pr && pr.done) { LD.app.toast("This prize is complete. Pick another one.", "warn"); return; }
      if (nr.preventDuplicates && avail < 1) {
        this.status = "error";
        LD.app.toast("All numbers have already been drawn.", "error");
        this.refreshStage();
        return;
      }

      let count = Math.min(this.count, pr ? this.prizeCap(pr) : 99, 99);
      if (count < 1) count = 1;
      if (nr.preventDuplicates && count > avail) {
        this.status = "error";
        LD.app.toast("Winner count cannot exceed the available numbers.", "error");
        this.refreshStage();
        return;
      }
      this.count = count;

      const numbers = LD.drawRangeNumbers(count);
      if (!numbers || numbers.length < count) {
        this.status = "error";
        LD.app.toast(nr.preventDuplicates ? "All numbers have already been drawn." : "Could not draw enough numbers.", "error");
        this.refreshStage();
        return;
      }
      numbers.sort((a, b2) => a - b2);

      this.session = {
        kind: "range",
        from: b.from,
        to: b.to,
        digits: nr.digits || 0,
        prize: pr ? { uid: pr.uid, name: pr.name, emoji: pr.emoji, image: pr.image, winnerCount: pr.winnerCount } : null,
        count,
        winners: numbers,
        numbers,
        winnersShown: 0,
        seq: S.settings.revealMode === "sequential" && count > 1,
        registered: false,
      };
      this._busy = true;

      if (S.settings.useCountdown) {
        this.status = "countdown";
        this.refreshStage();
        this.countdown(() => this.beginSpin());
      } else {
        this.beginSpin();
      }
    },

    stopDraw() {
      this.clearTimers();
      LD.audio.spinStop();
      const had = ["countdown", "spinning", "slowing"].includes(this.status);
      this._busy = false;
      this.session = null;
      this.status = "ready";
      this.hideOverlays(false);
      this.renderRollIdle();
      this.refreshStage();
      if (had) LD.app.toast("Draw stopped");
    },

    startNewDraw() {
      this.clearTimers();
      this.hideOverlays(false);
      this.session = null;
      this._busy = false;
      this.status = "ready";
      this.renderRollIdle();
      this.refreshStage();
    },

    /* ---------------- countdown ---------------- */
    countdown(done) {
      const S = LD.getState();
      const total = Math.max(1, S.settings.countdownDuration || 3);
      const ov = this.el.countOverlay;
      ov.hidden = false;
      const anim = () => {
        const num = this.el.countNum;
        num.style.animation = "none"; void num.offsetWidth; num.style.animation = "";
        const word = this.el.countWord;
        word.style.animation = "none"; void word.offsetWidth; word.style.animation = "";
      };
      let n = total;
      const tick = () => {
        anim();
        this.el.countWord.textContent = "GET READY";
        this.el.countNum.textContent = String(n);
        LD.audio.countdown(n, false);
        n -= 1;
        if (n >= 1) { this.timers.push(setTimeout(tick, 950)); }
        else {
          this.timers.push(setTimeout(() => {
            anim();
            this.el.countWord.textContent = "GO!";
            this.el.countNum.textContent = "GO";
            LD.audio.go();
            this.timers.push(setTimeout(() => {
              ov.hidden = true;
              done();
            }, 520));
          }, 950));
        }
      };
      tick();
    },

    /* ---------------- spin ---------------- */
    beginSpin() {
      if (!this.session) return;
      LD.audio.go();
      this.status = "spinning";
      this.refreshStage();
this.el.rollViewport.hidden = false;
      if (this.el.rollGrid.hidden !== true) this.el.rollGrid.hidden = true;
      if (this.session.kind === "range") { this.el.rollTag.hidden = true; this.el.rollSub.hidden = true; }
      else { this.el.rollTag.hidden = false; this.el.rollTag.textContent = "DRAWING…"; }
      LD.audio.spinStart();

const durMs = Math.max(1600, (LD.state.settings.spinDuration || 5) * 1000);
      const slowMs = durMs * 0.2;
      const start = performance.now();
      const fastInt = 62, slowInt = 200;
      const self = this;
      const rangeN = this.session.kind === "range";
      const rand = () => rangeN
        ? self.session.from + ((Math.random() * (self.session.to - self.session.from + 1)) | 0)
        : self.session.pool[(Math.random() * self.session.pool.length) | 0];

      const tick = () => {
        const elapsed = performance.now() - start;
        const prog = Math.min(1, elapsed / durMs);
        if (!this.session || !this.isLive()) { this.clearTimers(); return; }

        const session = this.session;
        let candidate = rand();
        const target = session.winners[Math.min(session.winnersShown, session.count - 1)];
        if (prog > 0.62) {
          const bias = (prog - 0.62) / 0.38;
          if (Math.random() < bias) candidate = target;
        }
        this.renderRoll(candidate, true);
        LD.audio.tick();

        if (prog >= 1) {
          // final settle
          this.renderRoll(target, false);
          this.status = "slowing";
          this.refreshStage();
          LD.audio.spinStop();
          this.timers.push(setTimeout(() => this.settle(), 300));
          return;
        }

        const eased = Math.min(1, Math.pow(prog, 1.6));
        const interval = fastInt + (slowInt - fastInt) * eased;
        this.timers.push(setTimeout(tick, this.status === "slowing" ? slowInt : interval));
      };
      this.timers.push(setTimeout(tick, fastInt));
    },

settle() {
      if (!this.session || this.session.registered) { this.finishPresentation(); return; }
      this.session.registered = true;
      if (this.session.kind === "range") {
        LD.registerNumberDraw(this.session.prize, this.session.numbers, { markUsed: !!LD.numberRange().preventDuplicates, digits: this.session.digits, from: this.session.from, to: this.session.to });
      } else {
        LD.registerWinners(this.session.prize, this.session.winners, { removeWinners: LD.state.settings.removeWinners, displayFields: this.session.displayFields });
      }
      this.status = "revealing";
      this.refreshStage();
      this.syncStats();
      this.syncRangeUI();

      const S = LD.getState();
      const seq = this.session.seq;
      const count = this.session.count;

      if (seq) {
        this.winnersShown = 0;
        this.showReveal(0);
      } else if (count === 1) {
        this.showReveal(0);
      } else {
        this.showGrid();
      }
    },

    winnersShown: 0,

    winnerDisplayEntries(winner, fields) {
      const configured = Array.isArray(fields) && fields.length ? fields : ["name"];
      const seen = new Set();
      const entries = [];
      configured.forEach((key) => {
        const field = String(key == null ? "" : key).trim();
        if (!field || seen.has(field)) return;
        seen.add(field);
        const raw = LD.participantFieldValue(winner, field);
        const empty = LD.isEmptyFieldValue(raw);
        let value = empty ? "—" : String(raw);
        if (field === "code" && !empty) value = `#${value}`;
        else if (field === "name" && !empty) value = value.toUpperCase();
        entries.push({ key: field, value });
      });
      return entries.length ? entries : [{ key: "name", value: winner && winner.name ? String(winner.name).toUpperCase() : "—" }];
    },

    renderRevealFields(winner, fields) {
      const entries = this.winnerDisplayEntries(winner, fields);
      this.el.revealCode.textContent = "";
      this.el.revealName.textContent = entries[0] ? entries[0].value : "—";
      this.el.revealFields.innerHTML = "";
      entries.slice(1).forEach((entry) => {
        const field = document.createElement("div");
        field.className = "reveal-field";
        field.textContent = entry.value;
        this.el.revealFields.appendChild(field);
      });
    },

    /* ---------------- sequential reveal ---------------- */
showReveal(i) {
      const sess = this.session;
      const w = sess.winners[i];
      this.winnersShown = i + 1;
      this.status = "revealing";
      this.refreshStage();
      if (sess.kind === "range") {
        const txt = LD.fmtNumber(w, sess.digits || 0);
        this.el.revealCode.textContent = "";
        this.el.revealFields.innerHTML = "";
        this.el.revealName.textContent = txt;
        this.el.revealOverlay.dataset.kind = "range";
        const len = txt.length;
        const tSizes = {
          1: "clamp(120px,30vw,52vh)", 2: "clamp(108px,26vw,50vh)", 3: "clamp(96px,21vw,46vh)",
          4: "clamp(72px,16vw,36vh)", 5: "clamp(58px,13vw,30vh)",
        };
        this.el.revealName.style.fontSize = tSizes[len] || "clamp(48px,10vw,26vh)";
      } else {
        this.renderRevealFields(w, this.session.displayFields);
        this.el.revealName.style.fontSize = "";
        this.el.revealOverlay.dataset.kind = "";
      }
      this.el.revealPrizeName.textContent = sess.prize ? sess.prize.name : "LUCKY DRAW";
      const img = this.el.revealPrizeImg;
      img.innerHTML = sess.prize
        ? (sess.prize.image ? `<img src="${sess.prize.image}" alt=""/>` : sess.prize.emoji || "🏆")
        : "🎱";
      const S = LD.getState();
      this.el.revealRound.textContent = `Draw ${S.round} · Winner ${i + 1} / ${sess.count}`;

      const last = i === this.session.count - 1;
      this.el.revealNext.innerHTML = last
        ? `<svg><use href="#i-play"/></svg><span>NEXT DRAW</span>`
        : `<svg><use href="#i-play"/></svg><span>NEXT WINNER</span>`;
      this.el.revealGrid.style.display = this.session.seq && !last ? "" : "none";

      this.el.revealOverlay.hidden = false;
      this.el.gridOverlay.hidden = true;
      const card = this.el.revealCard;
      card.classList.remove("pop"); void card.offsetWidth;
      card.classList.add("pop");

      LD.audio.reveal();
      if (LD.state.settings.useConfetti) LD.fx.burstAt();

      this.renderRoll(w, false);
    },

    onRevealNext() {
      if (!this.session) return;
      const isLastReveal = this.winnersShown >= this.session.count;
      if (!isLastReveal) {
        // spin to next winner
        this.el.revealOverlay.hidden = true;
        this.spinToNext();
      } else {
        this.finishPresentation(true);
      }
    },

spinToNext() {
      if (!this.session) return;
      this.status = "spinning";
      this.refreshStage();
      if (this.session.kind === "range") { this.el.rollTag.hidden = true; this.el.rollSub.hidden = true; }
      else this.el.rollTag.textContent = "DRAWING…";
      LD.audio.spinStart();
      const sess = this.session;
      const target = sess.winners[this.winnersShown];
      const durMs = 1500;
      const start = performance.now();
      const rangeN = sess.kind === "range";
      const rand = () => rangeN
        ? sess.from + ((Math.random() * (sess.to - sess.from + 1)) | 0)
        : sess.pool[(Math.random() * sess.pool.length) | 0];
      const tick = () => {
        if (!this.isLive()) { this.clearTimers(); return; }
        const prog = Math.min(1, (performance.now() - start) / durMs);
        const c = rand();
        this.renderRoll(prog > 0.7 && Math.random() < (prog - 0.7) / 0.3 ? target : c, true);
        LD.audio.tick();
        if (prog >= 1) {
          LD.audio.spinStop();
          this.status = "slowing";
          this.refreshStage();
          this.timers.push(setTimeout(() => {
            this.renderRoll(target, false);
            this.winnersShown += 0;
            this.showReveal(this.winnersShown);
          }, 280));
          return;
        }
        this.timers.push(setTimeout(tick, 62 + 120 * Math.pow(prog, 2)));
      };
      this.timers.push(setTimeout(tick, 60));
    },

    /* ---------------- grid reveal ---------------- */
showGrid() {
      if (!this.session) return;
      this.status = "revealing";
      this.refreshStage();
      this.el.revealOverlay.hidden = true;
      this.el.gridOverlay.hidden = false;
      this.el.gridOverlay.dataset.kind = this.session.kind === "range" ? "range" : "";
      this.el.gridPrizeName.textContent = this.session.prize ? this.session.prize.name : "LUCKY DRAW";
      const grid = this.el.gridCards;
      const w = this.session.winners;
      const kind = this.session.kind;
      const digits = this.session.digits || 0;
      grid.innerHTML = w
        .map((x, i) => this.cellHtml(x, i, w.length, kind, digits, this.session.displayFields))
        .join("");
      grid.dataset.n = String(w.length);
      const S = LD.getState();
      this.el.revealRound.textContent = `Draw ${S.round}`;
      LD.audio.celebration();
      if (LD.state.settings.useConfetti) LD.fx.celebrate();
      this.winnersShown = w.length;
      this.status = "revealing";
      void this.el.stage.dataset;
    },

    onGridNext() {
      this.finishPresentation(true);
    },

    finishPresentation(showComplete) {
      const had = this.session;
      this.hideOverlays(true);
      this._busy = false;
      if (had) this.renderCompleteGrid();
      this.status = "completed";
      this.refreshStage();
      this.syncStats();
    },

renderCompleteGrid() {
      if (!this.session) return;
      const grid = this.el.rollGrid;
      const w = this.session.winners;
      const kind = this.session.kind;
      const digits = this.session.digits || 0;
      grid.hidden = false;
      this.el.rollViewport.hidden = true;
      this.el.rollTag.hidden = true;
      grid.innerHTML = w
        .map((x, i) => this.cellHtml(x, i, w.length, kind, digits, this.session.displayFields))
        .join("");
      grid.dataset.n = String(w.length);
    },

    cellHtml(x, i, len, kind, digits, fields) {
      if (kind === "range") {
        return `
          <article class="grid-cell${len === 1 ? " gc-hero" : ""}" style="animation-delay:${0.08 + i * 0.16}s">
            <div class="gc-rank">NUMBER ${String(i + 1).padStart(2, "0")}</div>
            <div class="gc-code">${LD.fmtNumber(x, digits)}</div>
            <div class="gc-name"></div>
            <div class="gc-fields"></div>
          </article>`;
      }
      const entries = this.winnerDisplayEntries(x, fields);
      const first = entries[0] || { key: "name", value: "—" };
      const rest = entries.slice(1);
      return `
        <article class="grid-cell${len === 1 ? " gc-hero" : ""}" style="animation-delay:${0.08 + i * 0.16}s">
          <div class="gc-rank">WINNER ${String(i + 1).padStart(2, "0")}</div>
          <div class="gc-code"></div>
          <div class="gc-name">${this.esc(first.value)}</div>
          <div class="gc-fields">${rest.map((entry) => `<div class="gc-field">${this.esc(entry.value)}</div>`).join("")}</div>
        </article>`;
    },

    hideOverlays(keepGrid) {
      this.el.countOverlay.hidden = true;
      this.el.revealOverlay.hidden = true;
      this.el.gridOverlay.hidden = true;
      void keepGrid;
    },

    /* ---------------- rolling visuals ---------------- */
renderRoll(p, spinning) {
      const mode = LD.state.settings.drawMode;
      const rollMain = this.el.rollMain;
      if (!rollMain) return;
      if (this.inRangeMode()) {
        const s = this.session;
        const digits = s && s.digits != null ? s.digits : LD.numberRange().digits;
        const b = s && s.from != null ? { from: s.from, to: s.to } : LD.rangeBounds();
        rollMain.textContent = LD.fmtNumber(p, digits);
        this.el.rollSub.textContent = b.ok ? `${b.from} — ${b.to}` : "SET RANGE";
        return;
      }
      const code = p ? "#" + p.code : "#————";
      const name = p ? p.name : "";
      if (mode === "name") {
        rollMain.textContent = name.toUpperCase();
        this.el.rollSub.textContent = code;
      } else if (mode === "participant") {
        rollMain.textContent = code;
        this.el.rollSub.textContent = name.toUpperCase();
      } else {
        rollMain.textContent = code;
        this.el.rollSub.textContent = name.toUpperCase();
      }
      if (spinning && mode !== "name") rollMain.textContent = code;
    },

renderRollIdle() {
      this.el.rollSub.hidden = false;
      if (this.inRangeMode()) {
        const b = LD.rangeBounds();
        this.el.rollMain.textContent = "···";
        this.el.rollSub.textContent = b.ok ? `${b.from} — ${b.to}` : "SET RANGE";
      } else {
        this.el.rollMain.textContent = "#————";
        this.el.rollSub.textContent = "LUCKY DRAW";
      }
      this.el.rollGrid.hidden = true;
      this.el.rollViewport.hidden = false;
      this.el.rollTag.hidden = true;
      this.refreshStage();
    },

    /* ---------------- helpers ---------------- */
    esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); },

    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },
    clearTimers() {
      this.timers.forEach((t) => clearTimeout(t));
      this.timers = [];
    },
  };

  window.LD = Object.assign(window.LD || {}, { draw });
})();


