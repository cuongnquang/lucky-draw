/* ============================================================
   views.js — home / participants / prizes / history rendering
   ============================================================ */
(function () {
  "use strict";
  const S = () => LD.getState();

  const views = {
    init() {
      const node = (id) => document.getElementById(id);

      /* home */
      node("evName").addEventListener("input", (e) => { S().event.name = e.target.value; LD.save(); LD.draw.syncStats(); });
      node("evSub").addEventListener("input", (e) => { S().event.subtitle = e.target.value; LD.save(); });
      node("evLogo").addEventListener("change", (e) => this.pickLogo(e.target.files[0]));
      node("evBgImage").addEventListener("change", (e) => this.pickBg(e.target.files[0]));
      node("evBgClear").addEventListener("click", () => { S().event.bgImage = null; LD.save(); this.renderHome(); LD.draw.refresh(); });
      node("evLogoClear").addEventListener("click", (e) => { e.stopPropagation(); S().event.logo = null; node("evLogo").value = ""; LD.save(); this.renderHome(); LD.draw.refresh(); LD.app.toast("Logo removed"); });
      document.getElementById("themeGrid").addEventListener("click", (e) => {
        const b = e.target.closest(".theme-swatch[data-theme]");
        if (!b) return;
        S().event.theme = b.dataset.theme;
        document.body.dataset.theme = b.dataset.theme;
        LD.save();
        this.renderHome();
        LD.draw.refresh();
      });

      node("btnLoadDemo").addEventListener("click", () => this.loadDemo());
      node("btnRangeDemo").addEventListener("click", () => this.tryRangeDemo());
      node("btnResetAll").addEventListener("click", () =>
        LD.app.confirm("Clear everything?", "This wipes the event, participants, prizes and history.", () => {
          LD.clearAll(); LD.draw.prizeUid = null; LD.draw.session = null; LD.draw.status = "idle";
          LD.app.refreshAll(); LD.app.toast("All data cleared", "success");
        }));
      node("btnResetRound").addEventListener("click", () =>
        LD.app.confirm("Reset the game?", "All participants become eligible again and history is cleared.", () => {
          LD.resetGame(); LD.app.refreshAll(); LD.app.toast("Game reset — everyone is eligible again", "success");
        }));

      node("btnDemoPart").addEventListener("click", () => this.generateDemoParticipants());
       node("btnImportCsvHome").addEventListener("click", () => this.openImport());
       node("btnExportCsvHome").addEventListener("click", () => this.exportParticipants());
       node("btnDrawFieldsHome").addEventListener("click", () => this.openDrawFields());
      node("btnStartDraw").addEventListener("click", () => {
        LD.app.goto("draw");
        LD.draw.refresh();
      });
      node("homePrizeSelect").addEventListener("change", (e) => LD.draw.setPrize(e.target.value));
      node("homeCountMinus").addEventListener("click", () => LD.draw.stepCount(-1));
      node("homeCountPlus").addEventListener("click", () => LD.draw.stepCount(1));
      node("homeCount").addEventListener("change", (e) => LD.draw.setCount(parseInt(e.target.value, 10) || 1));
      node("toggleRemoveWinners").addEventListener("change", (e) => this.setRemoveWinners(e.target.checked));
      node("toggleRemoveWinners2").addEventListener("change", (e) => this.setRemoveWinners(e.target.checked));

      /* participants */
      node("btnAddPart").addEventListener("click", () => this.partForm(null));
      node("btnAddPart2").addEventListener("click", () => this.partForm(null));
      node("btnImportCsv").addEventListener("click", () => this.openImport());
      node("btnImportCsv2").addEventListener("click", () => this.openImport());
      node("btnExportCsv").addEventListener("click", () => this.exportParticipants());
      ["partSearch", "partFilter", "partSort"].forEach((id) =>
        node(id).addEventListener("input", () => this.renderParticipants()));

      /* prizes */
      node("btnSelectPrize").addEventListener("click", () => this.openPrizeSelect());
      node("btnAddPrize").addEventListener("click", () => this.prizeForm(null));
      node("btnAddPrize2").addEventListener("click", () => this.prizeForm(null));

      /* history */
      node("histSearch").addEventListener("input", () => this.renderHistory());
      node("histFilter").addEventListener("change", () => this.renderHistory());
      node("btnExportHist").addEventListener("click", () => this.exportHistory());
      node("btnClearHist").addEventListener("click", () =>
        LD.app.confirm("Clear history?", "Winner history will be erased. Winners stay marked.", () => {
          S().history = []; LD.save(); this.renderHistory(); LD.draw.syncStats(); LD.app.toast("History cleared", "success");
        }));

      document.addEventListener("click", (e) => {
        const dg = e.target.closest("[data-goto]");
        if (dg && dg.dataset.goto) { LD.app.goto(dg.dataset.goto); }
      });
    },

    setRemoveWinners(v) {
      S().settings.removeWinners = v;
      LD.save();
      const a = document.getElementById("toggleRemoveWinners"), b = document.getElementById("toggleRemoveWinners2");
      if (a) a.checked = v; if (b) b.checked = v;
      LD.app.refreshAll();
      LD.app.toast(v ? "Winners will be excluded from future draws" : "Winners stay eligible for future draws");
    },

    pickLogo(file) {
      if (!file) return;
      LD.imageToDataURL(file, 480).then((url) => {
        S().event.logo = url; LD.save(); this.renderHome(); LD.draw.refresh();
        LD.app.toast("Logo updated", "success");
      }).catch(() => LD.app.toast("Could not read that image", "error"));
    },
    pickBg(file) {
      if (!file) return;
      LD.imageToDataURL(file, 1600).then((url) => {
        S().event.bgImage = url; LD.save(); this.renderHome(); LD.draw.refresh();
        LD.app.toast("Background image applied", "success");
      }).catch(() => LD.app.toast("Could not read that image", "error"));
    },

    loadDemo() {
      const st = LD.demoEvent();
      Object.assign(S(), st);
      LD.draw.prizeUid = null; LD.draw.count = 1; LD.draw.session = null; LD.draw.status = "idle";
      LD.save();
      LD.app.refreshAll();
      LD.app.toast("Demo event TECH FEST 2026 loaded — everything is ready to draw", "success");
    },

    generateDemoParticipants() {
      const rnd = LD.mulberry32(Date.now() >>> 0);
      let added = 0, skipped = 0;
      const existing = new Set(S().participants.map((p) => p.code));
      for (let i = 1; i <= 100; i++) {
        const code = String(i).padStart(5, "0");
        if (existing.has(code)) { skipped++; continue; }
        S().participants.push({
          uid: LD.uid(), code,
          name: (() => {
            const SUR = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Đặng", "Bùi", "Đỗ"];
            const MID = ["Văn", "Thị", "Minh", "Quang", "Hữu", "Bảo", "Ngọc", "Phương"];
            const F = ["An", "Bình", "Cường", "Dũng", "Hải", "Hùng", "Huy", "Linh", "Long", "Minh", "Nam", "Ngọc", "Phát", "Quân", "Sơn", "Tâm", "Tuấn", "Việt", "Vinh", "Trang"];
            return SUR[(rnd() * SUR.length) | 0] + " " + MID[(rnd() * MID.length) | 0] + " " + F[(rnd() * F.length) | 0];
          })(),
          phone: "0" + (["96", "97", "98", "90", "91", "93", "94", "36", "37", "39"])[(rnd() * 10) | 0] + String(((rnd() * 9000000 + 1000000) | 0)).padStart(7, "0"),
          dept: ["Engineering", "Product", "Marketing", "Sales", "HR", "Finance", "Design", "Operations"][(rnd() * 8) | 0],
          eligible: true, excluded: false, wins: 0, wonPrizes: [],
        });
        added++;
      }
      LD.save();
      LD.app.refreshAll();
      LD.app.toast(`Generated ${added} participants${skipped ? ` (${skipped} skipped — codes exist)` : ""}`, added ? "success" : "warn");
    },

    /* ================= PARTICIPANTS ================= */
    renderParticipants() {
      const st = S();
      const q = document.getElementById("partSearch").value.trim().toLowerCase();
      const filter = document.getElementById("partFilter").value;
      const sort = document.getElementById("partSort").value;

      let list = st.participants.slice();
      if (filter !== "all") list = list.filter((p) => LD.statusOf(p) === filter);
       if (q) list = list.filter((p) => {
         const fields = LD.participantFieldEntries(p).map((entry) => entry.value).join(" ");
         return (fields + " " + (p.code || "")).toLowerCase().includes(q);
       });
      list.sort((a, b) => {
        if (sort === "id-desc") return parseInt(b.code, 10) - parseInt(a.code, 10);
        if (sort === "name") return a.name.localeCompare(b.name, "vi");
        if (sort === "dept") return (a.dept || "").localeCompare(b.dept || "");
        if (sort === "phone") return (a.phone || "").localeCompare(b.phone || "");
        return parseInt(a.code, 10) - parseInt(b.code, 10);
      });

      const total = st.participants.length;
      const eligible = LD.eligiblePool().length;
      const winners = LD.winnerTotal();
      const body = document.getElementById("partTbody");
      const empty = document.getElementById("partEmpty");

      if (!total) {
        body.innerHTML = "";
        empty.hidden = false;
        document.getElementById("partEmptyTitle").textContent = "No participants yet";
        document.getElementById("partEmptyMsg").textContent = "Import a CSV with any participant columns or add participants manually — then hit START DRAW.";
      } else if (!list.length) {
        body.innerHTML = "";
        empty.hidden = false;
        document.getElementById("partEmptyTitle").textContent = "Nothing matches your search";
        document.getElementById("partEmptyMsg").textContent = "Try a different keyword or clear the filters above.";
        empty.querySelectorAll("button").forEach((b) => (b.hidden = true));
      } else {
        empty.hidden = true;
        empty.querySelectorAll("button").forEach((b) => (b.hidden = false));
        const preview = list.length <= 1000;
        const shown = preview ? list : list.slice(0, 1000);
        body.innerHTML = shown.map((p, i) => this.partRow(p, i + 1)).join("") +
           (!preview ? `<tr><td colspan="8" class="td-dim" style="text-align:center;padding:16px">Showing first 1000 of ${list.length} — refine with search/filter.</td></tr>` : "");
      }
      document.getElementById("partSummary").textContent = `${total} total · ${eligible} eligible · ${winners} winner${winners === 1 ? "" : "s"}`;
      LD.draw.syncStats();
    },

     partRow(p, idx) {
       const st = LD.statusOf(p);
       const pill = st === "winner"
         ? `<span class="pill pill-winner"><span class="dot"></span>Winner ×${p.wins}</span>`
         : st === "excluded"
           ? `<span class="pill pill-excluded"><span class="dot"></span>Excluded</span>`
           : `<span class="pill pill-eligible"><span class="dot"></span>Eligible</span>`;
       const imported = LD.participantFieldEntries(p).filter((entry) => !["code", "name", "phone", "dept"].includes(entry.key));
       const importedHtml = imported.length
         ? `<details class="part-data-details"><summary>View all data</summary><div class="part-data-list">${imported.map((entry) => `<div class="part-data-item"><span>${this.esc(LD.fieldLabel(entry.key))}</span><span>${this.esc(entry.value)}</span></div>`).join("")}</div></details>`
         : `<span class="td-dim">—</span>`;
       return `<tr>
         <td data-label="#" class="td-dim">${idx}</td>
         <td data-label="ID" class="td-code">#${this.esc(p.code)}</td>
         <td data-label="Name" class="td-name">${this.esc(p.name)}</td>
         <td data-label="Phone" class="td-dim">${this.esc(p.phone || "—")}</td>
         <td data-label="Dept" class="td-dim">${this.esc(p.dept || "—")}</td>
         <td data-label="Imported data" class="td-imported">${importedHtml}</td>
         <td data-label="Status">${pill}</td>
         <td class="td-actions">
           <button class="icon-btn" data-part-detail="${this.esc(p.uid)}" title="View participant data" aria-label="View data for ${this.esc(p.name)}"><svg><use href="#i-search"/></svg></button>
           <button class="icon-btn" data-part-edit="${this.esc(p.uid)}" title="Edit" aria-label="Edit ${this.esc(p.name)}"><svg><use href="#i-edit"/></svg></button>
           <button class="icon-btn danger" data-part-del="${this.esc(p.uid)}" title="Delete ${this.esc(p.name)}" aria-label="Delete ${this.esc(p.name)}"><svg><use href="#i-trash"/></svg></button>
         </td>
       </tr>`;
     },

     partDetail(pt) {
       const entries = LD.participantFieldEntries(pt);
       const items = entries.length
         ? entries.map((entry) => `<div class="participant-detail-item"><span>${this.esc(LD.fieldLabel(entry.key))}</span><strong>${this.esc(entry.value)}</strong></div>`).join("")
         : `<div class="participant-detail-item"><span>Data</span><strong>No details available</strong></div>`;
       LD.app.modal(`
         <h3>Participant data</h3>
         <p class="modal-sub">${this.esc(pt.name || "Participant")} · #${this.esc(pt.code || "")}</p>
         <div class="participant-detail-grid">${items}</div>
         <div class="modal-actions"><button class="btn btn-primary" data-modal-close>Done</button></div>`);
     },

     partForm(pt) {
      const isNew = !pt;
      pt = pt || { code: "", name: "", phone: "", dept: "", excluded: false };
      LD.app.modal(`
        <h3>${isNew ? "Add participant" : "Edit participant"}</h3>
        <p class="modal-sub">${isNew ? "Enter their details — ID must be unique." : "Update details below."}</p>
        ${this.formErr || ""}
        <div class="modal-fields">
          <label class="field"><span>Participant ID</span><input id="mfCode" type="text" value="${this.esc(pt.code)}" placeholder="01829" maxlength="20"/></label>
          <label class="field"><span>Full name *</span><input id="mfName" type="text" value="${this.esc(pt.name)}" placeholder="Nguyễn Văn A" maxlength="80"/></label>
          <div class="field-row">
            <label class="field"><span>Phone / code</span><input id="mfPhone" type="text" value="${this.esc(pt.phone)}" placeholder="0901 234 567" maxlength="30"/></label>
            <label class="field"><span>Department</span><input id="mfDept" type="text" value="${this.esc(pt.dept)}" placeholder="Engineering" maxlength="60"/></label>
          </div>
          <label class="toggle"><input type="checkbox" id="mfExclude" ${pt.excluded ? "checked" : ""}/><span class="tui"></span><span><strong>Exclude from draws</strong><small>Manually keep them out of the pool.</small></span></label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-modal-close>Cancel</button>
          <button class="btn btn-primary" id="mfSave">${isNew ? "Add participant" : "Save changes"}</button>
        </div>`);
      const code = document.getElementById("mfCode"), name = document.getElementById("mfName");
      document.getElementById("mfSave").onclick = () => {
        const c = code.value.trim(), n = name.value.trim();
        const phone = document.getElementById("mfPhone").value.trim();
        const dept = document.getElementById("mfDept").value.trim();
        const excl = document.getElementById("mfExclude").checked;
        if (!n) { this.formErr = `<div class="modal-error">Name is required.</div>`; LD.app.closeModal(); this.partForm(pt); return; }
        if (!c) { this.formErr = `<div class="modal-error">Participant ID is required.</div>`; LD.app.closeModal(); this.partForm(pt); return; }
        if (LD.codeExists(c, pt.uid)) {
          this.formErr = `<div class="modal-error">ID "${c}" already exists. Use a unique ID.</div>`; LD.app.closeModal(); this.partForm(pt); return;
        }
        if (isNew) {
          LD.addParticipant({ uid: LD.uid(), code: c, name: n, phone, dept, eligible: !excl, excluded: excl, wins: 0, wonPrizes: [] });
          LD.app.toast("Participant added", "success");
        } else {
          LD.updateParticipant(pt.uid, { code: c, name: n, phone, dept, excluded: excl, eligible: !excl && pt.wins === 0 ? true : !excl });
          LD.app.toast("Participant updated", "success");
        }
        this.formErr = "";
        LD.app.closeModal();
        LD.app.refreshAll();
      };
      setTimeout(() => name.focus(), 60);
    },

    importFieldListHtml(columns, selected) {
      const byKey = new Map(columns.map((column) => [column.key, column]));
      const ordered = selected.map((key) => byKey.get(key)).filter(Boolean).concat(columns.filter((column) => !selected.includes(column.key)));
      return ordered.map((column) => {
        const index = selected.indexOf(column.key);
        const selectedClass = index >= 0 ? " is-selected" : "";
        const checked = index >= 0 ? " checked" : "";
        const order = index >= 0 ? String(index + 1) : "—";
        return `<div class="import-draw-row${selectedClass}">
          <label class="import-draw-label"><input type="checkbox" data-import-field="${this.esc(column.key)}"${checked}/><span title="${this.esc(column.label)}">${this.esc(column.label)}</span></label>
          <div class="import-draw-controls"><span class="import-draw-order">${order}</span>
            <button type="button" data-import-move="up" data-import-key="${this.esc(column.key)}" aria-label="Move ${this.esc(column.label)} up" title="Move up" ${index <= 0 ? "disabled" : ""}><svg><use href="#i-up"/></svg></button>
            <button type="button" data-import-move="down" data-import-key="${this.esc(column.key)}" aria-label="Move ${this.esc(column.label)} down" title="Move down" ${index < 0 || index === selected.length - 1 ? "disabled" : ""}><svg><use href="#i-down"/></svg></button>
          </div>
        </div>`;
      }).join("");
    },

    bindImportFieldList(container, selected, onChange) {
      container.onchange = (event) => {
        const input = event.target.closest("[data-import-field]");
        if (!input) return;
        const key = input.dataset.importField;
        if (input.checked) {
          if (!selected.includes(key)) selected.push(key);
        } else selected.splice(selected.indexOf(key), 1);
        onChange();
      };
      container.onclick = (event) => {
        const button = event.target.closest("[data-import-move]");
        if (!button || button.disabled) return;
        const key = button.dataset.importKey;
        const index = selected.indexOf(key);
        const next = button.dataset.importMove === "up" ? index - 1 : index + 1;
        if (index < 0 || next < 0 || next >= selected.length) return;
        selected.splice(index, 1);
        selected.splice(next, 0, key);
        onChange();
      };
    },

    importPreviewHtml(items, selected) {
      if (!items.length) return `<div class="import-preview-empty">Choose a participant name column to see a preview.</div>`;
      const participant = items[0];
      const fields = LD.participantFieldEntries(participant, selected).filter((entry) => entry.key !== "code");
      return `<div class="import-preview-title">WINNER 01</div>
        <div class="import-preview-code">#${this.esc(participant.code)}</div>
        <div class="import-preview-fields">${fields.map((entry) => `<div class="import-preview-field">${this.esc(entry.value)}</div>`).join("")}</div>`;
    },

    showImportModal(file, rows, detection) {
      let mapping = Object.assign({}, detection.mapping);
      const mappedColumn = (index) => detection.columns.find((column) => column.index === index);
      ["code", "name", "phone", "dept"].forEach((key) => {
        if (!mappedColumn(mapping[key])) mapping[key] = -1;
      });
      let selected = [];
      ["name", "dept"].forEach((key) => {
        const column = mappedColumn(mapping[key]);
        if (column && !selected.includes(column.key)) selected.push(column.key);
      });
      const syncSelectedForMapping = (key, previousIndex, nextIndex) => {
        const previousColumn = mappedColumn(previousIndex);
        const nextColumn = mappedColumn(nextIndex);
        const previousKey = previousColumn && previousColumn.key;
        const nextKey = nextColumn && nextColumn.key;
        const position = previousKey ? selected.indexOf(previousKey) : -1;
        if (position >= 0) {
          if (!nextKey) selected.splice(position, 1);
          else if (nextKey !== previousKey && selected.includes(nextKey)) selected.splice(position, 1);
          else selected[position] = nextKey;
        }
        if (key === "name" && nextKey && !selected.includes(nextKey)) selected.unshift(nextKey);
      };
      const mask = LD.app.modal(`
        <h3>Import participants</h3>
        <p class="modal-sub">Choose which CSV columns hold participant details and which should appear when someone wins.</p>
        <div class="import-file-summary"><div><strong>${this.esc(file.name)}</strong><span>${detection.dataRows.toLocaleString()} row${detection.dataRows === 1 ? "" : "s"} · ${detection.columns.length} column${detection.columns.length === 1 ? "" : "s"}</span></div><span>Detected ${detection.columns.length} column${detection.columns.length === 1 ? "" : "s"}</span></div>
        <div class="import-section">
          <div class="import-section-title">Participant fields</div>
          <p class="import-section-note">The participant name column is required. Leave code empty to generate one automatically.</p>
          <div class="import-mapping">
            <label class="field"><span>Participant name column</span><select data-import-map="name">${this.importMapOptions(detection.columns, mapping.name, "Choose a column")}</select></label>
            <label class="field"><span>Participant code</span><select data-import-map="code">${this.importMapOptions(detection.columns, mapping.code, "Generate codes")}</select></label>
            <label class="field"><span>Phone</span><select data-import-map="phone">${this.importMapOptions(detection.columns, mapping.phone, "Not mapped")}</select></label>
            <label class="field"><span>Department</span><select data-import-map="dept">${this.importMapOptions(detection.columns, mapping.dept, "Not mapped")}</select></label>
          </div>
        </div>
        <div class="import-section">
          <div class="import-section-title">Fields shown on winner screen</div>
          <p class="import-section-note">Choose what appears when a participant wins. The order below is the display order.</p>
          <div class="import-draw-list" id="importDrawList"></div>
          <div class="modal-error" id="importError" hidden></div>
        </div>
        <div class="import-section">
          <div class="import-section-title">Preview</div>
          <div class="import-preview" id="importPreview"></div>
          <div class="import-report" id="importReport"></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-modal-close>Cancel</button>
          <button class="btn btn-primary" id="importOk">Import</button>
        </div>`, { sticky: true });
      mask.querySelector(".modal").classList.add("modal-import");
      const drawList = mask.querySelector("#importDrawList");
      const preview = mask.querySelector("#importPreview");
      const report = mask.querySelector("#importReport");
      const error = mask.querySelector("#importError");
      const importButton = mask.querySelector("#importOk");
      const existingCodes = () => S().participants.map((participant) => participant.code);
      const render = () => {
        drawList.innerHTML = this.importFieldListHtml(detection.columns, selected);
        const built = LD.rowsToParticipants(rows, { columns: detection.columns, headers: detection.headers, hasHeader: detection.hasHeader, dataStart: detection.dataStart, mapping, existingCodes: existingCodes() });
        preview.innerHTML = this.importPreviewHtml(built.items, selected);
        const errors = built.errors || [];
        report.innerHTML = errors.length ? errors.map((message) => `<div class="bad">⚠ ${this.esc(message)}</div>`).join("") : `<div class="ok">✓ No issues detected.</div>`;
        const missingName = mapping.name < 0;
        const missingDrawField = selected.length === 0;
        error.hidden = !missingName && !missingDrawField;
        error.textContent = missingName ? "Choose the column containing participant names." : missingDrawField ? "Choose at least one field to show on the winner screen." : "";
        importButton.textContent = built.items.length ? `Import ${built.items.length}` : "Import";
        importButton.disabled = missingName || missingDrawField || !built.items.length;
      };
      mask.querySelectorAll("[data-import-map]").forEach((select) => {
        select.addEventListener("change", () => {
          const key = select.dataset.importMap;
          const previousIndex = mapping[key];
          const nextIndex = select.value === "" ? -1 : parseInt(select.value, 10);
          mapping[key] = nextIndex;
          syncSelectedForMapping(key, previousIndex, nextIndex);
          render();
        });
      });
      this.bindImportFieldList(drawList, selected, render);
      render();
      importButton.onclick = () => {
        const built = LD.rowsToParticipants(rows, { columns: detection.columns, headers: detection.headers, hasHeader: detection.hasHeader, dataStart: detection.dataStart, mapping, existingCodes: existingCodes() });
        if (mapping.name < 0 || !selected.length || !built.items.length) return;
        const existing = new Set(S().participants.map((participant) => participant.code));
        const duplicate = built.items.filter((item) => existing.has(item.code));
        const fresh = built.items.filter((item) => !existing.has(item.code));
        if (fresh.length) {
          fresh.forEach((item) => {
            const data = Object.create(null);
            Object.keys(item.data || {}).forEach((key) => { data[key] = item.data[key]; });
            S().participants.push({
              uid: LD.uid(), code: item.code, name: item.name, phone: item.phone, dept: item.dept, data,
              eligible: true, excluded: false, wins: 0, wonPrizes: [],
            });
          });
          LD.setImportFieldMetadata(detection.columns);
          LD.setDrawDisplayFields(selected);
          LD.save();
        }
        LD.app.closeModal(mask);
        LD.app.refreshAll();
        LD.app.toast(`Imported ${fresh.length} participants${duplicate.length ? ` — ${duplicate.length} duplicates skipped` : ""}`, fresh.length ? "success" : "warn");
      };
      return mask;
    },

    importMapOptions(columns, selected, emptyLabel) {
      return `<option value="">${this.esc(emptyLabel)}</option>` + columns.map((column) => `<option value="${column.index}"${column.index === selected ? " selected" : ""}>${this.esc(column.label)}</option>`).join("");
    },

    openImport() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,text/csv,.txt,.tsv,application/vnd.ms-excel";
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const rows = LD.parseCSV(await LD.readFileAsText(file));
          const detection = LD.detectCSVColumns(rows);
          if (!rows.length || !detection.columns.length) throw new Error("empty");
          this.showImportModal(file, rows, detection);
        } catch (error) {
          LD.app.toast("Import failed — could not read the file", "error");
        }
        input.value = "";
      };
      input.click();
    },

    openDrawFields() {
      const columns = LD.fieldCatalog();
      const byKey = new Map(columns.map((column) => [column.key, column]));
      let selected = LD.drawDisplayFields().filter((key) => byKey.has(key));
      if (!selected.length && byKey.has("name")) selected = ["name"];
      const mask = LD.app.modal(`
        <h3>Winner screen fields</h3>
        <p class="modal-sub">Choose which participant details appear when someone wins. The order below is the display order.</p>
        <div class="import-section">
          <div class="import-section-note">These fields are used by Random Name and Random Participant draws. Random Number keeps its ID-based presentation.</div>
          <div class="import-draw-list" id="drawFieldsList"></div>
          <div class="modal-error" id="drawFieldsError" hidden>Choose at least one field to show on the winner screen.</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-modal-close>Cancel</button>
          <button class="btn btn-primary" id="drawFieldsSave">Save fields</button>
        </div>`);
      const list = mask.querySelector("#drawFieldsList");
      const error = mask.querySelector("#drawFieldsError");
      const render = () => {
        list.innerHTML = this.importFieldListHtml(columns, selected);
        error.hidden = selected.length > 0;
      };
      this.bindImportFieldList(list, selected, render);
      render();
      mask.querySelector("#drawFieldsSave").onclick = () => {
        if (!LD.setDrawDisplayFields(selected)) {
          error.hidden = false;
          return;
        }
        LD.app.closeModal(mask);
        this.renderHome();
        LD.draw.refresh();
        LD.app.toast("Winner screen fields updated", "success");
      };
    },

    exportParticipants() {
      const list = LD.participantsExportRows(S().participants);
      const canonical = ["code", "name", "phone", "dept"];
      const custom = LD.fieldCatalog().filter((column) => !canonical.includes(column.key));
      const headers = canonical.concat(custom.map((column) => LD.exportDataKey(column.key)), ["wins", "status"]);
      const labels = canonical.map((key) => LD.fieldLabel(key)).concat(custom.map((column) => column.label), ["Wins", "Status"]);
      LD.download("participants.csv", LD.toCSV(list, headers, labels));
      LD.app.toast("Exported participants.csv", "success");
    },

    /* ================= PRIZES ================= */
    renderPrizes() {
      const st = S();
      const selId = LD.selectedPrizeId();
      const lbl = document.getElementById("btnSelectPrizeLbl");
      const btn = document.getElementById("btnSelectPrize");
      if (lbl) lbl.textContent = selId ? "Change prize" : "Select prize for draw";
      if (btn) btn.setAttribute("aria-label", selId ? "Change prize for next draw" : "Select prize for next draw");
      const list = st.prizes.slice().sort((a, b) => a.order - b.order);
      document.getElementById("prizeEmpty").hidden = list.length > 0;
      const rows = document.getElementById("prizeList");
      rows.innerHTML = list.map((p) => this.prizeRow(p)).join("");
      rows.querySelectorAll(".prize-row").forEach((row) => {
        row.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/prize", row.dataset.uid); row.classList.add("dragging"); });
        row.addEventListener("dragend", () => { row.classList.remove("dragging"); rows.querySelectorAll(".prize-row").forEach((r) => r.classList.remove("drag-over")); });
        row.addEventListener("dragover", (e) => { e.preventDefault(); row.classList.add("drag-over"); });
        row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
        row.addEventListener("drop", (e) => {
          e.preventDefault();
          const from = e.dataTransfer.getData("text/prize");
          if (!from || from === row.dataset.uid) return;
          LD.reorderPrize(from, row.dataset.uid);
          this.renderPrizes();
        });
      });
    },

    prizeRow(p) {
      const tier = ["SPECIAL PRIZE", "FIRST PRIZE", "SECOND PRIZE", "THIRD PRIZE", "CONSOLATION PRIZE"];
      const label = p.order <= tier.length ? tier[p.order - 1] : "PRIZE";
      const drawsDone = S().history.filter((h) => h.prize.uid === p.uid).length;
      const winners = S().history.reduce((n, h) => h.prize.uid === p.uid ? n + h.winners.length : n, 0);
      const qty = p.qty || 0;
      const remain = p.done ? 0 : Math.max(0, qty - drawsDone);
      const pct = qty ? Math.min(100, Math.round((drawsDone / qty) * 100)) : 100;
      const isSelected = p.uid === LD.selectedPrizeId();
      const status = p.done
        ? `<span class="prize-status prize-status-pill prize-status-done"><span class="dot"></span>Complete</span>`
        : `<span class="prize-status prize-status-pill prize-status-ready"><span class="dot"></span>Ready</span>`;
      return `<article class="prize-row${isSelected ? " is-selected" : ""}" draggable="true" data-uid="${p.uid}" data-order="${p.order}">
        <span class="drag-handle" title="Drag to reorder"><svg><use href="#i-drag"/></svg></span>
        <span class="prize-order">${String(p.order).padStart(2, "0")}</span>
        <div class="prize-info">
          <span class="prize-thumb">${p.image ? `<img src="${p.image}" alt=""/>` : (p.emoji || "🎁")}</span>
          <span class="pi-body">
            <span class="prize-kicker">${label}</span>
            <strong>${this.esc(p.name)}</strong>
            ${p.desc ? `<span class="prize-desc">${this.esc(p.desc)}</span>` : ""}
          </span>
        </div>
        <div class="prize-track">
          <div class="pt-top"><span>Remaining</span><b>${remain}/${qty}</b></div>
          <div class="prize-bar"><i style="width:${pct}%"></i></div>
        </div>
        <div class="prize-chips">
          ${isSelected ? `<span class="prize-status prize-status-pill prize-status-selected"><span class="dot"></span>Selected for next draw</span>` : ""}
          ${status}
          <span class="prize-chip"><b>${drawsDone}</b> drawn</span>
          <span class="prize-chip"><b>${winners}</b> winner${winners === 1 ? "" : "s"}</span>
        </div>
        <div class="prize-controls">
          <span class="prize-arrows">
            <button class="arrow-btn" data-prize-up="${p.uid}" title="Move up" aria-label="Move up"><svg><use href="#i-up"/></svg></button>
            <button class="arrow-btn" data-prize-down="${p.uid}" title="Move down" aria-label="Move down"><svg><use href="#i-down"/></svg></button>
          </span>
          <span class="prize-actions">
            <button class="btn btn-small ${p.done ? "btn-ghost" : "btn-outline"}" data-prize-done="${p.uid}">${p.done ? "✓ Complete" : "Mark done"}</button>
            <button class="icon-btn" data-prize-edit="${p.uid}" title="Edit" aria-label="Edit prize"><svg><use href="#i-edit"/></svg></button>
            <button class="icon-btn danger" data-prize-del="${p.uid}" title="Delete" aria-label="Delete prize"><svg><use href="#i-trash"/></svg></button>
          </span>
        </div>
      </article>`;
    },

    bindPrizeActions() {
      document.querySelectorAll("[data-prize-up]").forEach((b) => b.onclick = () => { LD.movePrize(b.dataset.prizeUp, -1); this.renderPrizes(); });
      document.querySelectorAll("[data-prize-down]").forEach((b) => b.onclick = () => { LD.movePrize(b.dataset.prizeDown, +1); this.renderPrizes(); });
      document.querySelectorAll("[data-prize-done]").forEach((b) => b.onclick = () => {
        const p = LD.prizeById(b.dataset.prizeDone); if (!p) return;
        const next = !p.done;
        LD.markPrizeDone(p.uid, next);
        this.renderPrizes();
        LD.draw.syncPrizeSelectors();
        LD.app.toast(next ? `"${p.name}" marked complete` : `"${p.name}" re-opened`);
      });
      document.querySelectorAll("[data-prize-edit]").forEach((b) => b.onclick = () => this.prizeForm(LD.prizeById(b.dataset.prizeEdit)));
      document.querySelectorAll("[data-prize-del]").forEach((b) => b.onclick = () => {
        const p = LD.prizeById(b.dataset.prizeDel); if (!p) return;
        LD.app.confirm(`Delete "${p.name}"?`, "This cannot be undone. Past winners in history keep a copy.", () => {
          LD.removePrize(p.uid); this.renderPrizes(); LD.app.refreshAll(); LD.app.toast("Prize deleted", "success");
        });
      });
    },

    prizeForm(p) {
      const isNew = !p;
      p = p || { name: "", emoji: "🎁", image: null, desc: "", winnerCount: 1, qty: 1 };
      LD.app.modal(`
        <h3>${isNew ? "Add prize" : "Edit prize"}</h3>
        <p class="modal-sub">${isNew ? "Set the prize and how many winners it has per draw." : "Update prize details."}</p>
        ${this.pformErr || ""}
        <div class="modal-fields">
          <div class="field-row">
            <label class="field field-grow"><span>Prize name *</span><input id="pfName" type="text" value="${this.esc(p.name)}" placeholder="iPhone 17 Pro" maxlength="60"/></label>
            <label class="field" style="max-width:120px"><span>Emoji</span><input id="pfEmoji" type="text" value="${this.esc(p.emoji || "🎁")}" maxlength="4" style="text-align:center;font-size:20px"/></label>
          </div>
          <label class="field"><span>Prize image (optional)</span>
            <div class="file-zone" id="pfZone">
              <span class="fz-preview" id="pfPrev">${p.image ? `<img src="${p.image}" alt=""/>` : (p.emoji || "🎁")}</span>
              <span class="fz-text">Upload an image<br/><small>PNG, JPG, SVG — optional</small></span>
            </div>
            <input id="pfImage" type="file" accept="image/*" hidden/>
          </label>
          <label class="field"><span>Description</span><textarea id="pfDesc" rows="2" maxlength="140" placeholder="Short tagline shown in the prize list">${this.esc(p.desc || "")}</textarea></label>
          <div class="field-row">
            <label class="field"><span>Winners per draw</span><input id="pfCount" type="number" min="1" max="99" value="${p.winnerCount || 1}"/></label>
            <label class="field"><span>Number of draws</span><input id="pfQty" type="number" min="1" max="999" value="${p.qty != null ? p.qty : p.winnerCount || 1}"/></label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-modal-close>Cancel</button>
          <button class="btn btn-primary" id="pfSave">${isNew ? "Add prize" : "Save changes"}</button>
        </div>`);
      document.getElementById("pfZone").onclick = () => document.getElementById("pfImage").click();
      document.getElementById("pfImage").onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        LD.imageToDataURL(f, 320).then((url) => {
          document.getElementById("pfPrev").innerHTML = `<img src="${url}" alt=""/>`;
          document.getElementById("pfPrev").dataset.url = url;
        }).catch(() => {});
      };
      document.getElementById("pfSave").onclick = () => {
        const name = document.getElementById("pfName").value.trim();
        const emoji = document.getElementById("pfEmoji").value.trim() || "🎁";
        const desc = document.getElementById("pfDesc").value.trim();
        const winnerCount = Math.max(1, parseInt(document.getElementById("pfCount").value, 10) || 1);
        const qty = Math.max(1, parseInt(document.getElementById("pfQty").value, 10) || 1);
        const imgEl = document.getElementById("pfPrev");
        const image = imgEl.dataset.url || null;
        if (!name) { this.pformErr = `<div class="modal-error">Prize name is required.</div>`; LD.app.closeModal(); this.prizeForm(p); return; }
        this.pformErr = "";
        if (isNew) LD.addPrize({ uid: LD.uid(), name, emoji, image, desc, winnerCount, qty, order: 0, done: false });
        else LD.updatePrize(p.uid, { name, emoji, image, desc, winnerCount, qty });
        LD.app.closeModal();
        LD.app.refreshAll();
        LD.app.toast(isNew ? "Prize added" : "Prize updated", "success");
      };
      setTimeout(() => document.getElementById("pfName").focus(), 60);
    },

    /* ================= HISTORY ================= */
    renderHistory() {
      const st = S();
      const q = document.getElementById("histSearch").value.trim().toLowerCase();
      const filter = document.getElementById("histFilter").value;

      const fs = document.getElementById("histFilter");
      const cur = fs.value;
      fs.innerHTML = `<option value="all">All prizes</option>` +
        st.prizes.map((p) => `<option value="${p.uid}">${this.esc(p.name)}</option>`).join("");
      fs.value = cur;

      let list = st.history.slice().sort((a, b) => b.time - a.time);
      if (filter !== "all") list = list.filter((h) => h.prize.uid === filter);
      if (q) list = list.filter((h) => {
        const prizeText = h.prize.name || "";
        const winnerText = h.winners.map((w) => {
          const data = w.data && typeof w.data === "object" ? Object.keys(w.data).map((key) => w.data[key]).join(" ") : "";
          return [w.code, w.name, w.phone, w.dept, data].join(" ");
        }).join(" ");
        return (prizeText + " " + winnerText).toLowerCase().includes(q);
      });

      const wrap = document.getElementById("histList");
      const empty = document.getElementById("histEmpty");
      document.getElementById("histSummary").textContent = `${st.round} round${st.round === 1 ? "" : "s"} · ${st.history.length} draw${st.history.length === 1 ? "" : "s"} recorded`;

      if (!st.history.length) { wrap.innerHTML = ""; empty.hidden = false; return; }
      empty.hidden = true;
      if (!list.length) {
        wrap.innerHTML = `<div class="table-empty"><div class="empty-art">🔍</div><h3>Nothing found</h3><p>No history matches your search.</p></div>`;
        return;
      }
      wrap.innerHTML = list.map((h) => this.histCard(h)).join("");
    },

    histCard(h) {
      const prizeImg = h.prize.image ? `<img src="${this.esc(h.prize.image)}" alt=""/>` : this.esc(h.prize.emoji || "🏆");
      const digits = h.digits == null ? S().settings.numberRange.digits : h.digits;
      const fields = Array.isArray(h.displayFields) ? h.displayFields : ["code", "name", "dept"];
      const winners = h.numbers
        ? h.numbers.map((n) => `<span class="hist-number">${LD.fmtNumber(n, digits)}</span>`).join("")
        : (h.winners || []).map((w) => {
          const extra = LD.participantFieldEntries(w, fields).filter((entry) => !["code", "name", "dept"].includes(entry.key));
          return `<span class="hist-winner">
              <span class="w-code">#${this.esc(w.code)}</span>
              <span class="w-name">${this.esc(w.name)}</span>
              ${w.dept ? `<span class="w-dept">${this.esc(w.dept)}</span>` : ""}
              ${extra.map((entry) => `<span class="w-data">${this.esc(entry.value)}</span>`).join("")}
            </span>`;
        }).join("");
      return `<article class="hist-card">
        <div class="hist-head">
          <span class="hist-round">ROUND ${String(h.round).padStart(2, "0")}</span>
          ${h.numbers ? `<span class="hist-type">NUMBER</span>` : ""}
          <span class="hist-prize"><span class="hist-img">${prizeImg}</span>${this.esc(h.prize.name)}</span>
          <span class="hist-count">${h.numbers ? `${h.numbers.length} num${h.numbers.length === 1 ? "" : "s"}` : `${(h.winners || []).length} winner${(h.winners || []).length === 1 ? "" : "s"}`}</span>
          <span class="hist-time">${LD.fmtTime(h.time)}</span>
        </div>
        <div class="hist-winners">
          ${winners}
        </div>
      </article>`;
    },

    exportHistory() {
      const flat = [];
      const dataKeys = [];
      S().history.forEach((h) => {
        if (h.numbers) {
          const digits = h.digits == null ? S().settings.numberRange.digits : h.digits;
          h.numbers.forEach((n) => flat.push({ round: h.round, time: LD.fmtTime(h.time), prize: h.prize.name, type: "Number", result: LD.fmtNumber(n, digits), dept: "", phone: "" }));
        } else {
          (h.winners || []).forEach((w) => {
            const row = { round: h.round, time: LD.fmtTime(h.time), prize: h.prize.name, type: "Participant", result: w.name + " (#" + w.code + ")", dept: w.dept || "", phone: w.phone || "" };
            Object.keys(w.data || {}).forEach((key) => {
              if (!dataKeys.includes(key)) dataKeys.push(key);
              row[LD.exportDataKey(key)] = w.data[key];
            });
            flat.push(row);
          });
        }
      });
      if (!flat.length) { LD.app.toast("No winners to export yet", "warn"); return; }
      const baseHeaders = ["round", "time", "prize", "type", "result", "dept", "phone"];
      const headers = baseHeaders.concat(dataKeys.map((key) => LD.exportDataKey(key)));
      const labels = baseHeaders.concat(dataKeys.map((key) => LD.fieldLabel(key)));
      LD.download("winners.csv", LD.toCSV(flat, headers, labels));
      LD.app.toast("Exported winners.csv", "success");
    },

    /* ================= HOME ================= */
    renderHome() {
      const st = S();
      const g = (id) => document.getElementById(id);
      g("evName").value = st.event.name || "";
      g("evSub").value = st.event.subtitle || "";
      g("evLogoPrev").innerHTML = st.event.logo ? `<img src="${st.event.logo}" alt=""/>` : "🎯";
      g("evLogo").value = "";
      g("evBgClear").hidden = !st.event.bgImage;

      document.querySelectorAll("#themeGrid .theme-swatch[data-theme]").forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.theme === st.event.theme ? "true" : "false"));

      const total = st.participants.length;
      g("mTotal").textContent = total;
      g("mEligible").textContent = LD.eligiblePool().length;
      g("mWon").textContent = LD.winnerTotal();
      g("toggleRemoveWinners").checked = st.settings.removeWinners;
      g("toggleRemoveWinners2").checked = st.settings.removeWinners;

      const eligible = LD.eligiblePool().length;
      const winners = LD.winnerTotal();
      const prizes = st.prizes.length;
      const completed = st.prizes.filter((p) => p.done).length;
      g("heroEvent").textContent = st.event.name || "No event yet";
      g("heroSub").textContent = st.event.subtitle || (total ? `${prizes} prize${prizes === 1 ? "" : "s"} lined up · ${eligible} eligible — run the draw to kick off` : "Set up your event to begin");
      g("heroMeta").textContent = `${total} participants · ${eligible} eligible · ${prizes} prizes · ${completed} completed · ${winners} winners`;
      const setStat = (id, n) => { const el = g(id); if (el) el.textContent = n; };
      setStat("mHTotal", total);
      setStat("mHEligible", eligible);
      setStat("mHPrizes", prizes);
      setStat("mHCompleted", completed);
      setStat("mHWinners", winners);

      const pr = LD.draw.prizeUid ? LD.prizeById(LD.draw.prizeUid) : null;
      const pp = g("homePrizePreview");
      pp.querySelector(".pp-kicker").textContent = pr ? this.prizeTier(pr) : "SELECT A PRIZE";
      pp.querySelector(".pp-name").textContent = pr ? pr.name : (st.prizes.length ? "Pick the first prize below" : "No prizes yet — add one to enable the draw");
      pp.querySelector(".pp-icon").innerHTML = pr ? (pr.image ? `<img src="${pr.image}" alt=""/>` : (pr.emoji || "🎁")) : "🎁";
      g("homeCount").value = LD.draw.count || 1;
      g("homePrizeSelect").value = LD.draw.prizeUid || "";

      const pool = LD.eligiblePool().length;
      const fieldHint = LD.drawDisplayFields().map((key) => LD.fieldLabel(key)).join(" · ");
      g("homeDrawFieldsHint").textContent = fieldHint || "Name";
      const mode = st.settings.drawMode;
      const modeLbl = {
        number: "🎯 Random Number",
        name: "👤 Random Name",
        participant: "🪪 Random Participant",
        range: "🎱 Number Range",
      }[mode] || "🎯 Random Number";
      g("homeModeTag").textContent = modeLbl;

      if (mode === "range") {
        const b = LD.rangeBounds();
        const used = LD.rangeUsed().length;
        const avail = b.ok ? b.total - used : 0;
        g("homeModeDetail").textContent = b.ok ? `RANGE ${b.from} — ${b.to} · ${avail} available · ${used} drawn` : "Range not configured — open Settings";
        g("homeRemainingHint").textContent = pr
          ? `${LD.fmtNumber(b.from || 0, 0)}–${LD.fmtNumber(b.to || 0, 0)} · ${avail} available · ${used} drawn · for “${pr.name}”`
          : b.ok ? `${b.from} – ${b.to} · ${avail} available numbers` : "Configure a valid range to enable the draw";
        g("homeCount").value = LD.draw.count || 1;
        g("homePrizeSelect").value = LD.draw.prizeUid || "";
      } else {
        g("homeModeDetail").textContent = pool ? `${pool} eligible participant${pool === 1 ? "" : "s"} ready` : "Add participants to enable the draw";
        const pr2 = pr;
        g("homeRemainingHint").textContent = pr2
          ? `${pool} eligible participant${pool === 1 ? "" : "s"} · ${pr2.qty} draw${pr2.qty > 1 ? "s" : ""} left for “${pr2.name}”`
          : pool ? `${pool} eligible participants ready` : "Add participants to enable the draw";
      }
      void total;
    },

    prizeTier(pr) {
      const tier = ["SPECIAL PRIZE", "FIRST PRIZE", "SECOND PRIZE", "THIRD PRIZE", "CONSOLATION PRIZE"];
      return tier[pr.order - 1] || "PRIZE";
    },

    /* ================= SELECT PRIZE FOR NEXT DRAW ================= */
    prizeSelectRowHtml(p) {
      const tier = ["SPECIAL PRIZE", "FIRST PRIZE", "SECOND PRIZE", "THIRD PRIZE", "CONSOLATION PRIZE"];
      const label = p.order <= tier.length ? tier[p.order - 1] : "PRIZE";
      const drawsDone = S().history.filter((h) => h.prize.uid === p.uid).length;
      const qty = (p.qty != null && p.qty > 0) ? p.qty : (p.winnerCount || 1);
      const remain = p.done ? 0 : Math.max(0, qty - drawsDone);
      const wc = p.winnerCount || 1;
      const img = p.image ? `<img src="${p.image}" alt=""/>` : (p.emoji || "🎁");
      const complete = p.done || remain <= 0;
      const picked = p.uid === LD.selectedPrizeId();
      const state = complete
        ? `<span class="ps-state">Complete</span>`
        : `<span class="ps-state"><span class="ps-check"></span>${picked ? "Selected" : "Select"}</span>`;
      const note = complete ? `<div class="ps-complete-note">No quantity remaining — this prize can no longer be drawn.</div>` : "";
      return `<button type="button" class="ps-row${picked ? " is-picked" : ""}" data-ps-uid="${p.uid}" ${complete ? "disabled aria-disabled='true'" : ""} aria-pressed="${picked ? "true" : "false"}">
        <span class="ps-thumb">${img}</span>
        <span class="ps-body">
          <span class="ps-tier">${label}</span>
          <strong>${this.esc(p.name)}</strong>
          <span class="ps-meta">${remain} of ${qty} remaining · ${wc} winner${wc === 1 ? "" : "s"}</span>
          ${note}
        </span>
        ${state}
      </button>`;
    },

    openPrizeSelect() {
      const st = S();
      const nextRound = (st.round || 0) + 1;
      const cards = st.prizes.slice().sort((a, b) => a.order - b.order).map((p) => this.prizeSelectRowHtml(p)).join("");
      const mask = LD.app.modal(`
        <h3>Select prize for draw</h3>
        <p class="modal-sub">Choose the prize to use in the next draw.</p>
        <p class="modal-round-ctx">NEXT DRAW &nbsp;·&nbsp; ROUND ${String(nextRound).padStart(2, "0")}</p>
        <div class="prize-select-list" id="psList">
          ${cards || `<div class="table-empty"><div class="empty-art">🎁</div><h3>No prizes yet</h3><p>Create a prize first, then select it for the draw.</p></div>`}
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-modal-close>Cancel</button>
          <button class="btn btn-primary" id="psConfirm" disabled>Confirm selection</button>
        </div>`);
      mask.querySelector(".modal").classList.add("modal-wider");

      let pending = null;
      const rows = [...mask.querySelectorAll(".ps-row:not(:disabled)")];
      const renderPick = (row, on) => {
        row.classList.toggle("is-picked", on);
        row.setAttribute("aria-pressed", on ? "true" : "false");
        const state = row.querySelector(".ps-state");
        state.innerHTML = "";
        const check = document.createElement("span");
        check.className = "ps-check";
        if (on) check.innerHTML = `<svg aria-hidden="true"><use href="#i-check"/></svg>`;
        state.appendChild(check);
        state.appendChild(document.createTextNode(on ? "Selected" : "Select"));
      };
      rows.forEach((r) => r.addEventListener("click", () => {
        pending = r.dataset.psUid;
        rows.forEach((x) => renderPick(x, x.dataset.psUid === pending));
        document.getElementById("psConfirm").disabled = false;
      }));
      if (LD.selectedPrizeId()) {
        pending = LD.selectedPrizeId();
        rows.forEach((x) => renderPick(x, x.dataset.psUid === pending));
        document.getElementById("psConfirm").disabled = false;
      }
      document.getElementById("psConfirm").onclick = () => {
        const pr = LD.prizeById(pending);
        if (!pr) return;
        LD.setSelectedPrize(pending);
        LD.draw.setPrize(pending, null, true);
        LD.app.closeModal(mask);
        this.renderPrizes();
        LD.app.refreshAll();
        LD.app.toast(`"${pr.name}" selected for the next draw.`, "success");
      };
    },

    /* ================= DRAW SETTINGS ================= */
    openSettings() {
      const s = S().settings;
      const nr = LD.numberRange();
      this.setErr = this.setErr || "";
      LD.app.modal(`
        <h3>Draw settings</h3>
        <p class="modal-sub">Fine-tune how the machine behaves on stage.</p>
        ${this.setErr || ""}
        <div class="modal-fields">
          <label class="field"><span>Draw mode</span>
            <select id="sMode">
              <option value="number" ${s.drawMode === "number" ? "selected" : ""}>Random Number — participant ID</option>
              <option value="name" ${s.drawMode === "name" ? "selected" : ""}>Random Name — show full name</option>
              <option value="participant" ${s.drawMode === "participant" ? "selected" : ""}>Random Participant — ID + name</option>
              <option value="range" ${s.drawMode === "range" ? "selected" : ""}>Number Range — random integer</option>
            </select></label>

          <div id="sRangeCfg" class="range-cfg" ${s.drawMode === "range" ? "" : "hidden"}>
            <div class="range-cfg-title">Number Range</div>
            <div class="field-row">
              <label class="field"><span>From</span><input id="sRgFrom" type="number" min="0" value="${nr.from}"/></label>
              <label class="field"><span>To</span><input id="sRgTo" type="number" min="1" value="${nr.to}"/></label>
            </div>
            <label class="field"><span>Preset</span>
              <select id="sRgPreset">
                <option value="">Custom…</option>
                <option value="1,10">1 – 10</option>
                <option value="1,100">1 – 100</option>
                <option value="1,500">1 – 500</option>
                <option value="1,1000">1 – 1000</option>
                <option value="1,5000">1 – 5000</option>
                <option value="1,10000">1 – 10000</option>
              </select></label>
            <div class="field-row">
              <label class="field"><span>Number format</span>
                <select id="sRgDigits">
                  <option value="0" ${!nr.digits ? "selected" : ""}>Normal · 25</option>
                  <option value="3" ${nr.digits === 3 ? "selected" : ""}>3 digits · 025</option>
                  <option value="4" ${nr.digits === 4 ? "selected" : ""}>4 digits · 0025</option>
                  <option value="5" ${nr.digits === 5 ? "selected" : ""}>5 digits · 00025</option>
                  <option value="6" ${nr.digits === 6 ? "selected" : ""}>6 digits · 000025</option>
                </select></label>
              <label class="field"><span>Winners per draw</span><input id="sRgCount" type="number" min="1" max="99" value="${LD.draw.count || 1}"/></label>
            </div>
            <label class="toggle"><input type="checkbox" id="sRgUnique" ${nr.preventDuplicates ? "checked" : ""}/><span class="tui"></span><span><strong>Prevent duplicate numbers</strong><small>Drawn numbers stay out of future rounds until reset.</small></span></label>
          </div>

          <label class="field"><span>Reveal style</span>
            <select id="sReveal">
              <option value="all" ${s.revealMode === "all" ? "selected" : ""}>Reveal all winners at once</option>
              <option value="sequential" ${s.revealMode === "sequential" ? "selected" : ""}>Reveal one by one</option>
            </select></label>
          <label class="toggle"><input type="checkbox" id="sRemove" ${s.removeWinners ? "checked" : ""}/><span class="tui"></span><span><strong>Remove winners from future draws</strong></span></label>
          <div class="field-row">
            <label class="toggle"><input type="checkbox" id="sCountdown" ${s.useCountdown ? "checked" : ""}/><span class="tui"></span><span><strong>Countdown 3·2·1</strong></span></label>
            <label class="toggle"><input type="checkbox" id="sConfetti" ${s.useConfetti ? "checked" : ""}/><span class="tui"></span><span><strong>Confetti</strong></span></label>
          </div>
          <label class="toggle"><input type="checkbox" id="sSound" ${s.useSound ? "checked" : ""}/><span class="tui"></span><span><strong>Sound effects</strong></span></label>
          <div class="field-row">
            <label class="field"><span>Countdown length (s)</span><input id="sCountDur" type="number" min="1" max="10" value="${s.countdownDuration}"/></label>
            <label class="field"><span>Spin length (s)</span><input id="sSpinDur" type="number" min="2" max="15" value="${s.spinDuration}"/></label>
          </div>
        </div>
        <div class="modal-actions"><button class="btn btn-ghost" data-modal-close>Cancel</button><button class="btn btn-primary" id="sSave">Save settings</button></div>`);
      document.getElementById("sMode").addEventListener("change", (e) => {
        document.getElementById("sRangeCfg").hidden = e.target.value !== "range";
      });
      document.getElementById("sRgPreset").addEventListener("change", (e) => {
        if (!e.target.value) return;
        const [f, t] = e.target.value.split(",");
        document.getElementById("sRgFrom").value = f;
        document.getElementById("sRgTo").value = t;
      });
      document.getElementById("sSave").onclick = () => {
        const mode = document.getElementById("sMode").value;
        const n = Object.assign(S().settings, {
          drawMode: mode,
          revealMode: document.getElementById("sReveal").value,
          removeWinners: document.getElementById("sRemove").checked,
          useCountdown: document.getElementById("sCountdown").checked,
          useConfetti: document.getElementById("sConfetti").checked,
          useSound: document.getElementById("sSound").checked,
          countdownDuration: Math.max(1, parseInt(document.getElementById("sCountDur").value, 10) || 3),
          spinDuration: Math.max(2, parseInt(document.getElementById("sSpinDur").value, 10) || 5),
        });
        S().settings = n;
        if (mode === "range") {
          const from = parseInt(document.getElementById("sRgFrom").value, 10);
          const to = parseInt(document.getElementById("sRgTo").value, 10);
          const count = parseInt(document.getElementById("sRgCount").value, 10) || 1;
          const uniq = document.getElementById("sRgUnique").checked;
          const digits = parseInt(document.getElementById("sRgDigits").value, 10) || 0;
          if (!Number.isInteger(from) || from < 0) {
            this.setErr = `<div class="modal-error">From must be a whole number, 0 or greater.</div>`;
            LD.app.closeModal(); this.openSettings(); return;
          }
          if (!Number.isInteger(to) || !(to > from)) {
            this.setErr = `<div class="modal-error">To must be a whole number greater than From.</div>`;
            LD.app.closeModal(); this.openSettings(); return;
          }
          if (!Number.isInteger(count) || count < 1) {
            this.setErr = `<div class="modal-error">Winner count must be at least 1.</div>`;
            LD.app.closeModal(); this.openSettings(); return;
          }
          if (uniq && count > to - from + 1) {
            this.setErr = `<div class="modal-error">Winner count cannot exceed the available numbers.</div>`;
            LD.app.closeModal(); this.openSettings(); return;
          }
          LD.setRangeConfig({ from, to, digits, preventDuplicates: uniq });
          LD.draw.count = Math.min(count, 99);
          LD.draw.setCount(LD.draw.count);
        }
        LD.audio.setSound(S().settings.useSound);
        LD.save();
        LD.app.closeModal();
        LD.app.refreshAll();
        LD.app.toast(n.drawMode === "range" ? "Number Range draw enabled" : "Settings saved", "success");
      };
    },

    tryRangeDemo() {
      const st = S();
      st.settings.drawMode = "range";
      LD.setRangeConfig({ from: 1, to: 1000, digits: 0, preventDuplicates: false, used: LD.numberRange().used });
      st.settings.revealMode = "all";
      LD.draw.count = 1;
      if (!LD.selectedPrizeId() && st.prizes.length) LD.draw.prizeUid = st.prizes[0].uid;
      LD.draw.session = null;
      LD.draw.status = "ready";
      LD.save();
      LD.app.goto("draw");
      LD.draw.refresh();
      LD.app.toast("Number Range demo ready — 1 to 1000, pick a prize and press START", "success");
    },

    esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); },
  };

  /* table-level delegated clicks for participants + prizes actions */
  function bindTableDelegation() {
    document.getElementById("partTbody").addEventListener("click", (e) => {
      const detail = e.target.closest("[data-part-detail]");
      const edit = e.target.closest("[data-part-edit]");
      const del = e.target.closest("[data-part-del]");
      if (detail) {
        const p = S().participants.find((x) => x.uid === detail.dataset.partDetail);
        if (p) views.partDetail(p);
      } else if (edit) {
        const p = S().participants.find((x) => x.uid === edit.dataset.partEdit);
        if (p) views.partForm(p);
      } else if (del) {
        const p = S().participants.find((x) => x.uid === del.dataset.partDel);
        if (p) LD.app.confirm(`Delete ${p.name} (#${p.code})?`, "They will be removed from the event list.", () => {
          LD.removeParticipant(p.uid); views.renderParticipants(); LD.draw.syncStats(); LD.app.toast("Participant deleted", "success");
        });
      }
    });
    document.getElementById("prizeList").addEventListener("click", views.bindPrizeActions.bind(views));
  }

  window.LD = Object.assign(window.LD || {}, { views, bindTableDelegation });
})();

/* small helper used in template building */
function escapeHtml(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}