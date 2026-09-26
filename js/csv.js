(function () {
  "use strict";

  const PARTICIPANT_CANONICAL_FIELDS = ["code", "name", "phone", "dept"];
  const DATA_EXPORT_PREFIX = "data:";
  const HEADER_ALIASES = {
    code: [
      "id", "code", "participant id", "participant code", "staff id", "employee id", "employee code",
      "stt", "no", "number", "mã", "mã nv", "mã nhân viên", "mã số", "mã người chơi", "số thứ tự",
    ],
    name: [
      "name", "full name", "participant name", "participant", "tên", "họ tên", "ho ten", "tên người chơi", "tên nhân viên",
    ],
    phone: [
      "phone", "mobile", "phone number", "sđt", "sdt", "điện thoại", "dien thoai", "số điện thoại", "so dien thoai",
    ],
    dept: [
      "department", "dept", "team", "division", "phòng", "bộ phận", "bo phan", "phòng ban", "phong ban", "ban",
    ],
  };

  function text(value) {
    return String(value == null ? "" : value).replace(/^\uFEFF/, "").trim();
  }

  function defineOwn(target, key, value) {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
    return target;
  }

  function exportDataKey(key) {
    return DATA_EXPORT_PREFIX + String(key == null ? "" : key);
  }

  function normalizedHeader(value) {
    let value2 = text(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    if (value2.normalize) value2 = value2.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return value2.replace(/đ/g, "d");
  }

  const HDR_LOOKUP = (() => {
    const map = new Map();
    for (const key of Object.keys(HEADER_ALIASES)) {
      for (const alias of HEADER_ALIASES[key]) map.set(normalizedHeader(alias), key);
    }
    return map;
  })();

  function canonicalHeader(value) {
    return HDR_LOOKUP.get(normalizedHeader(value)) || null;
  }

  function looksLikeNumber(value) {
    return /^[-+]?\d+(?:[.,]\d+)*$/.test(text(value));
  }

  function looksLikeHeader(row, nextRow) {
    const cells = (row || []).map(text);
    if (!cells.some(Boolean)) return false;
    if (cells.some((cell) => HDR_LOOKUP.has(normalizedHeader(cell)))) return true;
    if (cells.length < 2 || !nextRow) return false;
    const firstLooksLikeCode = /^(?:\d+|[a-z]{1,8}[-_]?\d{2,})$/i.test(cells[0]);
    const anotherLooksNumeric = cells.slice(1).some(looksLikeNumber);
    if (firstLooksLikeCode || anotherLooksNumeric) return false;
    return cells.every(Boolean) && nextRow.some((cell) => String(cell == null ? "" : cell).trim() !== "");
  }

  function makeColumns(headerRow, width, hasHeader) {
    const used = new Map();
    const columns = [];
    for (let i = 0; i < width; i++) {
      const raw = hasHeader ? text(headerRow[i]) : "";
      const label = raw || `Column ${i + 1}`;
      const detected = hasHeader ? canonicalHeader(raw) : (i === 0 ? "code" : i === 1 ? "name" : i === 2 ? "phone" : i === 3 ? "dept" : null);
      let canonical = detected;
      if (used.has(detected || "")) canonical = null;
      const base = canonical || label;
      let key = base;
      let suffix = 2;
      while (used.has(key)) {
        key = `${base}__${suffix}`;
        suffix++;
      }
      used.set(key, i);
      columns.push({ index: i, key, label, canonical });
    }
    return columns;
  }

  function widthOf(rows) {
    return rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
  }

  function detectCSVColumns(rows) {
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) {
      return { hasHeader: false, columns: [], headers: [], mapping: { code: -1, name: -1, phone: -1, dept: -1 }, dataStart: 0, dataRows: 0, rowCount: 0 };
    }
    const width = widthOf(rows);
    const hasHeader = looksLikeHeader(rows[0], rows[1]);
    const headers = hasHeader ? Array.from({ length: width }, (_, i) => text(rows[0][i])) : [];
    const columns = makeColumns(rows[0], width, hasHeader);
    const mapping = { code: -1, name: -1, phone: -1, dept: -1 };
    if (hasHeader) {
      columns.forEach((column) => {
        if (column.canonical && mapping[column.canonical] === -1) mapping[column.canonical] = column.index;
      });
    } else {
      mapping.code = 0;
      mapping.name = 1;
      mapping.phone = 2;
      mapping.dept = 3;
    }
    return {
      hasHeader,
      columns,
      headers,
      mapping,
      dataStart: hasHeader ? 1 : 0,
      dataRows: Math.max(0, rows.length - (hasHeader ? 1 : 0)),
      rowCount: rows.length,
    };
  }

  function normalizeMapping(mapping, columns) {
    const result = { code: -1, name: -1, phone: -1, dept: -1 };
    ["code", "name", "phone", "dept"].forEach((key) => {
      const value = mapping && mapping[key];
      const index = value == null || value === "" ? -1 : parseInt(value, 10);
      result[key] = Number.isInteger(index) && index >= 0 && index < columns.length ? index : -1;
    });
    return result;
  }

  function normalizeRow(raw) {
    raw = raw || {};
    const result = {
      code: text(raw.code),
      name: text(raw.name),
      phone: text(raw.phone),
      dept: text(raw.dept),
    };
    if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
      result.data = {};
      Object.keys(raw.data).forEach((key) => { defineOwn(result.data, key, text(raw.data[key])); });
    }
    return result;
  }

  function rowsToParticipants(rows, options) {
    options = options || {};
    const detection = options.columns ? {
      hasHeader: !!options.hasHeader,
      columns: options.columns,
      headers: options.headers || [],
      mapping: options.mapping || { code: -1, name: -1, phone: -1, dept: -1 },
      dataStart: options.dataStart == null ? (options.hasHeader ? 1 : 0) : options.dataStart,
      dataRows: Math.max(0, (rows || []).length - (options.dataStart == null ? (options.hasHeader ? 1 : 0) : options.dataStart)),
      rowCount: (rows || []).length,
    } : detectCSVColumns(rows);
    const items = [];
    const errors = [];
    const seen = new Set();
    const reserved = new Set();
    const dataRows = Array.isArray(rows) ? rows : [];
    const columns = detection.columns || [];
    const mapping = normalizeMapping(options.mapping || detection.mapping, columns);
    if (mapping.name < 0) {
      return Object.assign({}, detection, { mapping, items, errors: ["Choose the column containing participant names."], skipped: 0 });
    }

    const pick = (row, index) => (index >= 0 && row && row[index] != null ? text(row[index]) : "");
    const mappedIndexes = new Set([mapping.code, mapping.phone, mapping.dept, mapping.name].filter((index) => index >= 0));
    if (Array.isArray(options.existingCodes)) options.existingCodes.forEach((code) => { if (code != null && text(code)) reserved.add(text(code)); });
    else if (options.existingCodes && typeof options.existingCodes.forEach === "function") options.existingCodes.forEach((code) => { if (code != null && text(code)) reserved.add(text(code)); });
    for (let r = detection.dataStart; r < dataRows.length; r++) {
      const explicitCode = pick(dataRows[r], mapping.code);
      if (explicitCode) reserved.add(explicitCode);
    }
    let nextGeneratedCode = 1;
    for (let r = detection.dataStart; r < dataRows.length; r++) {
      const row = dataRows[r];
      if (!row || row.every((cell) => cell === "" || cell == null)) continue;
      const name = pick(row, mapping.name);
      let code = pick(row, mapping.code);
      if (!code) {
        let generated = String(nextGeneratedCode).padStart(5, "0");
        while (seen.has(generated) || reserved.has(generated)) {
          nextGeneratedCode += 1;
          generated = String(nextGeneratedCode).padStart(5, "0");
        }
        code = generated;
        reserved.add(code);
        nextGeneratedCode += 1;
      }
      const phone = pick(row, mapping.phone);
      const dept = pick(row, mapping.dept);
      const linen = r + 1;
      if (!name) {
        errors.push(`Row ${linen}: missing name (skipped).`);
        continue;
      }
      if (seen.has(code)) {
        errors.push(`Row ${linen}: duplicate code "${code}" (skipped).`);
        continue;
      }
      seen.add(code);
      const data = {};
      columns.forEach((column) => {
        if (!mappedIndexes.has(column.index)) defineOwn(data, column.key, pick(row, column.index));
      });
      items.push({ code, name, phone, dept, data });
    }
    return Object.assign({}, detection, { mapping, items, errors, skipped: errors.length });
  }

  function toCSV(records, headerKeys, headerLabels) {
    const esc = (value) => {
      value = value == null ? "" : String(value);
      if (/^[\s]*[=+\-@]/.test(value)) value = "'" + value;
      return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
    };
    const recordsList = Array.isArray(records) ? records : [];
    const headers = Array.isArray(headerKeys) && headerKeys.length
      ? headerKeys
      : recordsList[0] && typeof recordsList[0] === "object" ? Object.keys(recordsList[0]) : [];
    const labels = Array.isArray(headerLabels) && headerLabels.length === headers.length ? headerLabels : headers;
    return "\uFEFF" + labels.map(esc).join(",") + "\n" +
      recordsList.map((record) => headers.map((header) => {
        const value = record && Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "";
        return esc(value);
      }).join(",")).join("\n");
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => { document.body.removeChild(anchor); URL.revokeObjectURL(url); }, 400);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, "utf-8");
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function imageToDataURL(file, maxDim = 640) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
          const width = Math.round(image.width * scale);
          const height = Math.round(image.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(image, 0, 0, width, height);
          try { resolve(canvas.toDataURL("image/png")); }
          catch (error) { resolve(reader.result); }
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function participantsExportRows(list) {
    return (list || []).map((participant) => {
      const row = {};
      defineOwn(row, "code", participant.code);
      defineOwn(row, "name", participant.name);
      defineOwn(row, "phone", participant.phone);
      defineOwn(row, "dept", participant.dept);
      defineOwn(row, "wins", participant.wins);
      defineOwn(row, "status", LD.statusOf(participant));
      const data = participant.data && typeof participant.data === "object" ? participant.data : {};
      Object.keys(data).forEach((key) => { defineOwn(row, exportDataKey(key), data[key]); });
      return row;
    });
  }

  window.LD = Object.assign(window.LD || {}, {
    exportDataKey,
    parseCSV(textValue) {
      textValue = String(textValue == null ? "" : textValue).replace(/^\uFEFF/, "");
      const counts = { ",": 0, "\t": 0, ";": 0 };
      let quoted = false;
      for (let i = 0; i < textValue.length; i++) {
        const character = textValue[i];
        if (character === '"') {
          if (quoted && textValue[i + 1] === '"') i++;
          else quoted = !quoted;
        } else if (!quoted && Object.prototype.hasOwnProperty.call(counts, character)) counts[character] += 1;
        else if (!quoted && (character === "\n" || character === "\r")) break;
      }
      const delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ",";
      const rows = [];
      let row = [];
      let field = "";
      let inQuotes = false;
      for (let i = 0; i < textValue.length; i++) {
        const character = textValue[i];
        if (inQuotes) {
          if (character === '"') {
            if (textValue[i + 1] === '"') { field += '"'; i++; }
            else inQuotes = false;
          } else field += character;
        } else if (character === '"') {
          inQuotes = true;
        } else if (character === delimiter) {
          row.push(field);
          field = "";
        } else if (character === "\n" || character === "\r") {
          if (character === "\r" && textValue[i + 1] === "\n") i++;
          row.push(field);
          field = "";
          if (row.length > 1 || row[0] !== "") rows.push(row);
          row = [];
        } else field += character;
      }
      if (inQuotes) throw new Error("Unclosed quoted field");
      if (field !== "" || row.length) { row.push(field); rows.push(row); }
      return rows;
    },
    rowsToParticipants,
    detectCSVColumns,
    canonicalHeader,
    toCSV,
    download,
    readFileAsText,
    imageToDataURL,
    readFileAsDataURL,
    participantsExportRows,
    normalizeRow,
  });
})();
