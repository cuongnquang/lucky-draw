/* ============================================================
   app.js — boot, router, ui helpers, presentation mode
   ============================================================ */
(function () {
  "use strict";

  let activeView = "home";

  function dismiss(el) {
    clearTimeout(el.dataset.t);
    if (!el.isConnected) return;
    el.classList.add("out");
    setTimeout(() => el.remove(), 320);
  }

  const app = {
    /* ---------------- lifecycle ---------------- */
    init() {
      const bootedDemo = LD.load();
      document.body.dataset.theme = LD.getState().event.theme || "navy";

      document.querySelectorAll(".nav-item").forEach((b) =>
        b.addEventListener("click", () => app.goto(b.dataset.view)));

      const dd = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("click", fn);
      };
      dd("dockSound", () => { const v = LD.audio.on; LD.audio.setSound(!v); app.syncSoundIcons(); });
      dd("dockMusic", () => LD.draw.toggleMusic());
      dd("dockFullscreen", () => app.togglePresentation());
      dd("btnDrawSettings", () => LD.views.openSettings());
      dd("sidebarToggle", () => app.toggleSidebar());
      dd("heroStartDraw", () => { app.goto("draw"); LD.draw.refresh(); });
      dd("railToggle", () => app.toggleRail());

      LD.views.init();
      LD.draw.init();
      LD.bindTableDelegation();

      document.addEventListener("keydown", this.onKey);
      document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) {
          document.body.classList.remove("presentation", "rail-open");
          app.syncRail();
        }
      });

      app.goto("home");
      app.refreshAll();
      app.syncSoundIcons();
      app.syncMusicIcons();

      if (bootedDemo) {
        setTimeout(() => app.toast('Demo event loaded — open the DRAW view and press START (Space)', "success"), 600);
      }
    },

    /* ---------------- router ---------------- */
    goto(view) {
      if (["home", "participants", "prizes", "history", "draw"].indexOf(view) < 0) view = "home";
      activeView = view;
      document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
      const el = document.getElementById("view-" + view);
      if (el) el.hidden = false;
      document.querySelectorAll(".nav-item").forEach((b) =>
        b.classList.toggle("is-active", b.dataset.view === view));
      if (view === "home") LD.views.renderHome();
      if (view === "participants") LD.views.renderParticipants();
      if (view === "prizes") LD.views.renderPrizes();
      if (view === "history") LD.views.renderHistory();
      if (view === "draw") {
        LD.draw.refresh();
        if (!LD.draw.session && !["countdown", "spinning", "slowing", "revealing"].includes(LD.draw.status)) {
          LD.draw.renderRollIdle();
        }
      }
      if (el) el.scrollTop = 0;
      app.renderEventChip();
    },

    refreshAll() {
      if (activeView === "home") LD.views.renderHome();
      else if (activeView === "participants") LD.views.renderParticipants();
      else if (activeView === "prizes") LD.views.renderPrizes();
      else if (activeView === "history") LD.views.renderHistory();
      LD.draw.refresh();
      app.renderEventChip();
    },

    renderEventChip() {
      const st = LD.getState();
      const el = document.getElementById("ecName");
      const sub = document.getElementById("ecSub");
      const logo = document.getElementById("ecLogo");
      el.textContent = st.event.name || "No event yet";
      sub.textContent = st.event.subtitle || (st.participants.length + " participants");
      logo.innerHTML = st.event.logo ? `<img src="${st.event.logo}" alt=""/>` : "🎯";
    },

    /* ---------------- sidebar ---------------- */
    toggleSidebar() {
      const on = !document.body.classList.contains("sidebar-collapse");
      document.body.classList.toggle("sidebar-collapse", on);
      const btn = document.getElementById("sidebarToggle");
      if (btn) {
        btn.setAttribute("aria-expanded", on ? "false" : "true");
        btn.setAttribute("aria-label", on ? "Expand sidebar" : "Collapse sidebar");
      }
      app.renderEventChip();
    },

    /* ---------------- presentation / fullscreen ---------------- */
    togglePresentation() {
      const on = !document.body.classList.contains("presentation");
      if (on) {
        if (activeView !== "draw") app.goto("draw");
        document.body.classList.add("presentation");
        document.body.classList.add("mouse-active");
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        app.toast("Presentation mode — large stage. C toggles controls. F to exit.");
      } else {
        document.body.classList.remove("presentation", "mouse-active", "rail-open");
        app.syncRail();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    },

    /* ---------------- collapsible operator rail ---------------- */
    toggleRail() {
      document.body.classList.toggle("rail-open");
      app.syncRail();
    },
    syncRail() {
      const btn = document.getElementById("railToggle");
      if (!btn) return;
      const open = document.body.classList.contains("rail-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Collapse controls" : "Expand controls");
    },

    /* ---------------- sound icon sync ---------------- */
    syncSoundIcons() {
      const on = LD.audio.on;
      const set = (id, on_) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute("aria-pressed", on_ ? "true" : "false");
        el.querySelector("use").setAttribute("href", on_ ? "#i-sound" : "#i-muted");
      };
      set("dockSound", on); set("stageSound", on); set("opSound", on);
    },
    syncMusicIcons() {
      const playing = LD.audio.isMusicPlaying();
      const set = (id) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute("aria-pressed", playing ? "true" : "false");
      };
      set("dockMusic"); set("opMusic");
    },

    /* ---------------- toasts ---------------- */
    toast(msg, type = "info", dur = 3400) {
      const root = document.getElementById("toast-root");
      const icon = type === "success" ? "✓" : type === "error" ? "!" : type === "warn" ? "▲" : "i";
      const el = document.createElement("div");
      el.className = "toast toast-" + type;
      el.setAttribute("role", type === "error" ? "alert" : "status");
      el.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${LD.views.esc(msg)}</span><button class="toast-close" aria-label="Dismiss">×</button>`;
      el.querySelector(".toast-close").onclick = () => dismiss(el);
      root.appendChild(el);
      while (root.children.length > 5) dismiss(root.firstElementChild);
      const t = setTimeout(() => dismiss(el), dur);
      el.dataset.t = t;
    },

    /* ---------------- modal ---------------- */
    modal(innerHTML, opts = {}) {
      const root = document.getElementById("modal-root");
      const mask = document.createElement("div");
      mask.className = "modal-mask";
      mask.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="modal-close" data-modal-close aria-label="Close dialog"><svg aria-hidden="true"><use href="#i-close"/></svg></button>${innerHTML}</div>`;
      root.appendChild(mask);
      mask._prevFocus = document.activeElement;
      mask.addEventListener("click", (e) => {
        if (e.target === mask && !opts.sticky) app.closeModal(mask);
      });
      // focus trap: keep Tab cycling inside the dialog while it is open
      mask.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        const f = mask.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) { e.preventDefault(); return; }
        const first = f[0], last = f[f.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !mask.contains(active)) { e.preventDefault(); last.focus(); }
        } else {
          if (active === last || !mask.contains(active)) { e.preventDefault(); first.focus(); }
        }
      });
      app.closeModalRef = mask;
      const firstInput = mask.querySelector("input,textarea,select");
      if (firstInput) setTimeout(() => firstInput.focus(), 30);
      else {
        const firstFocusable = mask.querySelector('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])');
        if (firstFocusable) setTimeout(() => firstFocusable.focus(), 30);
      }
      return mask;
    },
    closeModal(ref) {
      const root = document.getElementById("modal-root");
      const target = ref || root.lastElementChild;
      if (target) {
        const prev = target._prevFocus;
        target.remove();
        if (prev && prev.focus && prev.isConnected) prev.focus();
      }
    },

    confirm(title, msg, onOk, okLabel = "Yes, continue") {
      const mask = this.modal(`
        <h3>${LD.views.esc(title)}</h3>
        <p class="modal-sub">${LD.views.esc(msg)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-modal-close>Cancel</button>
          <button class="btn btn-danger" id="cfOk">${LD.views.esc(okLabel)}</button>
        </div>`, { sticky: false });
      mask.querySelector("[data-modal-close]").onclick = () => app.closeModal(mask);
      mask.querySelector("#cfOk").onclick = () => { app.closeModal(mask); onOk && onOk(); };
      return mask;
    },

    /* ---------------- keyboard ---------------- */
    onKey(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select";
      if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        app.toggleSidebar();
        e.preventDefault();
        return;
      }
      if (e.key === "F" || e.key === "f") {
        if (e.altKey) return;
        app.togglePresentation();
        e.preventDefault();
        return;
      }
      if ((e.key === "c" || e.key === "C") && !typing) {
        if (document.body.classList.contains("presentation") && window.innerWidth >= 1200) {
          app.toggleRail();
          e.preventDefault();
          return;
        }
      }
      if (e.key === " " && !typing) {
        const inStage = activeView === "draw" || document.body.classList.contains("presentation");
        if (inStage) {
          LD.draw.onCta();
          e.preventDefault();
        }
      }
      if (e.key === "Escape") {
        const mask = document.querySelector(".modal-mask");
        if (mask) { app.closeModal(mask); return; }
        document.body.classList.remove("presentation", "mouse-active", "rail-open");
        app.syncRail();
        return;
      }
      if (typing) return;
      const navFocus = e.target.closest ? e.target.closest(".nav-item") : null;
      if (navFocus && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Home" || e.key === "End")) {
        const items = [...document.querySelectorAll(".nav-item")];
        const idx = items.indexOf(navFocus);
        let n = idx;
        if (e.key === "ArrowDown") n = (idx + 1) % items.length;
        else if (e.key === "ArrowUp") n = (idx - 1 + items.length) % items.length;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = items.length - 1;
        if (n !== idx) { app.goto(items[n].dataset.view); items[n].focus(); e.preventDefault(); }
        return;
      }
      if (e.key === "ArrowUp" && activeView === "draw") { LD.draw.stepCount(1); e.preventDefault(); }
      if (e.key === "ArrowDown" && activeView === "draw") { LD.draw.stepCount(-1); e.preventDefault(); }
      if ((e.key === "r" || e.key === "R") && activeView === "draw" && LD.draw.inRangeMode() && !LD.draw.isLive()) {
        LD.draw.resetRange();
        e.preventDefault();
      }
    },
  };

  /* modal close on data-modal-close (delegated) */
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-modal-close]");
    if (c) app.closeModal();
  });

  window.LD = Object.assign(window.LD || {}, { app });
  window.addEventListener("DOMContentLoaded", () => app.init());
})();