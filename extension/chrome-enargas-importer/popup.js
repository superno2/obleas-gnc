const statusEl = document.getElementById("status");
const sendBtn = document.getElementById("sendBtn");
const copyBtn = document.getElementById("copyBtn");

function setStatus(message) {
  statusEl.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractVisibleText(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      function clean(value) {
        return (value || "").replace(/\s+/g, " ").trim();
      }

      function findValue(label) {
        const bodyText = document.body?.innerText || "";
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = bodyText.match(new RegExp(`${escaped}\\s*:?\\s*([^\\n]+)`, "i"));
        return clean(match?.[1] || "");
      }

      function normalizeKey(value) {
        return clean(value)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      }

      function tableRows(table) {
        return Array.from(table.rows).map(row => {
          return Array.from(row.cells).map(cell => clean(cell.innerText)).filter(Boolean);
        }).filter(row => row.length);
      }

      function findTablesByHeaders(requiredHeaders) {
        const required = requiredHeaders.map(normalizeKey);
        return Array.from(document.querySelectorAll("table")).filter(table => {
          const firstRow = tableRows(table)[0] || [];
          const headerText = normalizeKey(firstRow.join(" "));
          return required.every(header => headerText.includes(header));
        });
      }

      function componentBlock(title, requiredHeaders, index = 0) {
        const table = findTablesByHeaders(requiredHeaders)[index];
        if (!table) return "";
        const rows = tableRows(table);
        if (rows.length < 2) return "";
        return [title, rows.map(row => row.join("\t")).join("\n")].join("\n");
      }

      const canonical = [
        "Datos de la Operación",
        findValue("Operación") ? `Operación: ${findValue("Operación")}` : "",
        findValue("Oblea Actual") ? `Oblea Actual: ${findValue("Oblea Actual")}` : "",
        findValue("Fecha Operación") ? `Fecha Operación: ${findValue("Fecha Operación")}` : "",
        findValue("Fecha Habilitación") ? `Fecha Habilitación: ${findValue("Fecha Habilitación")}` : "",
        findValue("Fecha Vencimiento") ? `Fecha Vencimiento: ${findValue("Fecha Vencimiento")}` : "",
        "Datos del Vehículo",
        findValue("Marca") ? `Marca: ${findValue("Marca")}` : "",
        findValue("Año") ? `Año: ${findValue("Año")}` : "",
        findValue("Modelo") ? `Modelo: ${findValue("Modelo")}` : "",
        findValue("Uso") ? `Uso: ${findValue("Uso")}` : "",
        findValue("Dominio") ? `Dominio: ${findValue("Dominio")}` : "",
        componentBlock("Datos Regulador", ["Código Homologación", "Número de Serie", "Operación"], 0),
        componentBlock("Datos Cilindro", ["Código Homologación", "Número de Serie", "Fecha Fab", "CRPC"]),
        componentBlock("Dato Válvula del Cilindro", ["Código Homologación", "Número de Serie", "Operación"], 1)
      ].filter(Boolean).join("\n");

      const title = document.title || "";
      const url = location.href;
      const main = document.querySelector("article, main, .content_format, body");
      const text = (main?.innerText || document.body?.innerText || "").trim();
      const tableText = Array.from(document.querySelectorAll("table")).map(table => {
        return Array.from(table.rows).map(row => {
          return Array.from(row.cells).map(cell => cell.innerText.trim()).filter(Boolean).join("\t");
        }).filter(Boolean).join("\n");
      }).filter(Boolean).join("\n");
      return [canonical, title, url, text, tableText].filter(Boolean).join("\n");
    }
  });
  return (result?.result || "").trim();
}

async function extractEnargasData(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      function clean(value) {
        return (value || "").replace(/\s+/g, " ").trim();
      }

      function normalizeKey(value) {
        return clean(value)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      }

      function findValue(label) {
        const lines = (document.body?.innerText || "").split(/\n+/).map(clean).filter(Boolean);
        const wanted = normalizeKey(label);
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];
          const key = normalizeKey(line);
          if (key === wanted && lines[index + 1]) return lines[index + 1];
          if (key.startsWith(`${wanted} `)) return clean(line.slice(label.length).replace(/^:/, ""));
          const match = line.match(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*(.+)$`, "i"));
          if (match?.[1]) return clean(match[1]);
        }
        return "";
      }

      function tableRows(table) {
        return Array.from(table.rows).map(row => {
          return Array.from(row.cells).map(cell => clean(cell.innerText)).filter(Boolean);
        }).filter(row => row.length);
      }

      function findTablesByHeaders(requiredHeaders) {
        const required = requiredHeaders.map(normalizeKey);
        return Array.from(document.querySelectorAll("table")).filter(table => {
          const rows = tableRows(table);
          const headerText = normalizeKey((rows[0] || []).join(" "));
          return required.every(header => headerText.includes(header));
        });
      }

      function parseSimpleComponent(table) {
        const rows = table ? tableRows(table) : [];
        const row = rows[1] || [];
        return {
          code: row[0] || "",
          serial: row[1] || "",
          operation: row[2] || ""
        };
      }

      function parseSimpleComponents(table) {
        const rows = table ? tableRows(table).slice(1) : [];
        return rows.map(row => ({
          code: row[0] || "",
          serial: row[1] || "",
          operation: row[2] || ""
        })).filter(row => row.code || row.serial || row.operation);
      }

      function parseCylinders(table) {
        const rows = table ? tableRows(table) : [];
        return rows.slice(1).map(row => ({
          code: row[0] || "",
          serial: row[1] || "",
          operation: row[2] || "",
          manufactureDate: row[3] || "",
          crpc: row[4] || "",
          reviewDate: row[5] || "",
          result: row[6] || "",
          certificate: row[7] || ""
        })).filter(row => row.code || row.serial || row.operation);
      }

      const simpleTables = findTablesByHeaders(["Código Homologación", "Número de Serie", "Operación"]);
      const cylinderTable = findTablesByHeaders(["Código Homologación", "Número de Serie", "Fecha Fab", "CRPC"])[0];
      const regulator = parseSimpleComponent(simpleTables[0]);
      const valves = parseSimpleComponents(simpleTables[1]);
      const cylinders = parseCylinders(cylinderTable);
      const cylinderRows = (cylinders.length ? cylinders : [{}]).map((cylinder, index) => {
        const valve = valves[index] || {};
        return {
          cylinderCode: cylinder.code || "",
          cylinderSerial: cylinder.serial || "",
          cylinderOperation: cylinder.operation || "",
          cylinderManufactureDate: cylinder.manufactureDate || "",
          cylinderCrpc: cylinder.crpc || "",
          cylinderReviewDate: cylinder.reviewDate || "",
          valveCode: valve.code || "",
          valveSerial: valve.serial || "",
          valveOperation: valve.operation || ""
        };
      });
      const cylinder = cylinders[0] || {};
      const valve = valves[0] || {};
      const raw = [
        "Datos de la Operación",
        `Operación: ${findValue("Operación")}`,
        `Oblea Actual: ${findValue("Oblea Actual")}`,
        `Fecha Operación: ${findValue("Fecha Operación")}`,
        `Fecha Habilitación: ${findValue("Fecha Habilitación")}`,
        `Fecha Vencimiento: ${findValue("Fecha Vencimiento")}`,
        "Datos del Vehículo",
        `Marca: ${findValue("Marca")}`,
        `Año: ${findValue("Año")}`,
        `Modelo: ${findValue("Modelo")}`,
        `Uso: ${findValue("Uso")}`,
        `Dominio: ${findValue("Dominio")}`,
        "Datos Regulador",
        ["Código Homologación", "Número de Serie", "Operación"].join("\t"),
        [regulator.code, regulator.serial, regulator.operation].filter(Boolean).join("\t"),
        "Datos Cilindro",
        ["Código Homologación", "Número de Serie", "Operación", "Fecha Fab.", "CRPC", "Fecha CRPC", "Resultado", "Nro. Certificado"].join("\t"),
        ...cylinders.map(row => [row.code, row.serial, row.operation, row.manufactureDate, row.crpc, row.reviewDate, row.result, row.certificate].filter(Boolean).join("\t")),
        "Dato Válvula del Cilindro",
        ["Código Homologación", "Número de Serie", "Operación"].join("\t"),
        ...valves.map(row => [row.code, row.serial, row.operation].filter(Boolean).join("\t"))
      ].filter(line => !/:\s*$/.test(line) && line.trim()).join("\n");

      return {
        raw,
        fields: {
          waferNumber: findValue("Oblea Actual"),
          waferDue: findValue("Fecha Vencimiento"),
          vehicleBrand: findValue("Marca"),
          vehicleModel: findValue("Modelo"),
          vehicleYear: findValue("Año"),
          vehicleDomain: findValue("Dominio"),
          vehicleType: findValue("Uso"),
          regulatorActualCode: regulator.code,
          regulatorActualSerial: regulator.serial,
          regulatorOperation: regulator.operation,
          cylinderRows,
          cylinderCode: cylinder.code,
          cylinderSerial: cylinder.serial,
          cylinderOperation: cylinder.operation,
          cylinderManufactureDate: cylinder.manufactureDate,
          cylinderReviewDate: cylinder.reviewDate,
          cylinderCrpc: cylinder.crpc,
          valveCode: valve.code,
          valveSerial: valve.serial,
          valveOperation: valve.operation
        }
      };
    }
  });
  return result?.result || { raw: "", fields: {} };
}

function looksLikeEnargasDetail(text) {
  return /Datos de la Operaci[oó]n/i.test(text)
    && /Datos del Veh[ií]culo/i.test(text)
    && /(Datos Regulador|Datos Cilindro|Dato V[aá]lvula)/i.test(text);
}

function isRegistroGncTab(tab) {
  const url = tab.url || "";
  return /obleas-gnc/i.test(url)
    || /registro-gnc/i.test(url)
    || /\/index\.html$/i.test(url)
    || /vercel\.app/i.test(url);
}

async function findRegistroTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter(isRegistroGncTab);
}

async function fillRegistro(data) {
  const tabs = await findRegistroTabs();
  for (const tab of tabs) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [data],
        func: imported => {
          function clean(value) {
            return (value || "").replace(/\s+/g, " ").trim();
          }

          function normalizeKey(value) {
            return clean(value)
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, " ")
              .trim();
          }

          function normalizeDate(value) {
            const match = clean(value).match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
            if (!match) return clean(value);
            const day = match[1].padStart(2, "0");
            const month = match[2].padStart(2, "0");
            const year = match[3].length === 2 ? `20${match[3]}` : match[3];
            return `${year}-${month}-${day}`;
          }

          function normalizeMonth(value) {
            const match = clean(value).match(/\b(\d{1,2})\s*[\/.-]\s*(\d{2,4})\b/);
            if (!match) return clean(value);
            const month = match[1].padStart(2, "0");
            const year = match[2].length === 2 ? `20${match[2]}` : match[2];
            return `${month}/${year}`;
          }

          function setField(id, value) {
            const field = document.getElementById(id);
            if (!field || !clean(value)) return 0;
            field.value = clean(value);
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return 1;
          }

          function setSelect(id, value) {
            const field = document.getElementById(id);
            if (!field || !clean(value)) return 0;
            const key = normalizeKey(value);
            const option = Array.from(field.options).find(item => normalizeKey(item.value) === key || normalizeKey(item.textContent) === key);
            if (!option) return 0;
            field.value = option.value;
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return 1;
          }

          function normalizeRegulatorOperation(value) {
            const key = normalizeKey(value);
            if (!key || key === "sin cambios" || key === "actual" || key === "a") return "[A] Actual";
            if (key === "montaje" || key === "m") return "[M] Montaje";
            if (key === "desmontaje" || key === "d") return "[D] Desmontaje";
            if (key === "baja" || key === "b") return "[B] Baja";
            if (key === "baja por robo" || key === "br") return "[BR] Baja por Robo";
            return value;
          }

          function setRowField(row, fieldName, value) {
            const field = row.querySelector(`[data-cylinder-field="${fieldName}"]`);
            if (!field || !clean(value)) return 0;
            field.value = fieldName.includes("Operation") ? normalizeRegulatorOperation(value) : clean(value);
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
            return 1;
          }

          function fillCylinderRows(rows) {
            const dataRows = Array.isArray(rows) ? rows.filter(row => Object.values(row || {}).some(Boolean)) : [];
            if (!dataRows.length) return 0;
            const addButton = document.getElementById("addCylinderBtn");
            const list = document.getElementById("cylinderRows");
            if (!addButton || !list) return 0;
            while (list.querySelectorAll("[data-cylinder-row]").length < dataRows.length) addButton.click();
            let imported = 0;
            Array.from(list.querySelectorAll("[data-cylinder-row]")).forEach((row, index) => {
              const data = dataRows[index];
              if (!data) return;
              imported += setRowField(row, "cylinderCode", data.cylinderCode);
              imported += setRowField(row, "cylinderSerial", data.cylinderSerial);
              imported += setRowField(row, "cylinderOperation", data.cylinderOperation);
              imported += setRowField(row, "cylinderManufactureDate", normalizeMonth(data.cylinderManufactureDate));
              imported += setRowField(row, "cylinderCrpc", data.cylinderCrpc);
              imported += setRowField(row, "cylinderReviewDate", normalizeMonth(data.cylinderReviewDate));
              imported += setRowField(row, "valveCode", data.valveCode);
              imported += setRowField(row, "valveSerial", data.valveSerial);
              imported += setRowField(row, "valveOperation", data.valveOperation);
            });
            return imported;
          }

          const fields = imported.fields || {};
          let count = 0;
          count += setField("waferNumber", fields.waferNumber);
          count += setField("waferDue", normalizeDate(fields.waferDue));
          count += setField("vehicleBrand", fields.vehicleBrand);
          count += setField("vehicleModel", fields.vehicleModel);
          count += setField("vehicleYear", fields.vehicleYear);
          count += setField("vehicleDomain", fields.vehicleDomain);
          count += setSelect("vehicleType", fields.vehicleType);
          count += setField("regulatorCode", fields.regulatorActualCode);
          count += setField("regulatorSerial", fields.regulatorActualSerial);
          count += setSelect("regulatorOperation", normalizeRegulatorOperation(fields.regulatorOperation));
          count += fillCylinderRows(fields.cylinderRows);
          document.getElementById("recordTabBtn")?.click();
          return count;
        }
      });
      const count = result?.result || 0;
      if (count > 0) {
        await chrome.tabs.update(tab.id, { active: true });
        return count;
      }
    } catch {
      // Keep trying other tabs.
    }
  }
  return 0;
}

async function getCurrentEnargasText() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No pude leer la pestaña actual.");
  const text = await extractVisibleText(tab.id);
  if (!text) throw new Error("No encontré texto visible para importar.");
  return text;
}

sendBtn.addEventListener("click", async () => {
  try {
    setStatus("Leyendo detalle...");
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No pude leer la pestaña actual.");
    const text = await extractVisibleText(tab.id);
    if (!text || !looksLikeEnargasDetail(text)) {
      setStatus("Esta pestaña no parece ser el detalle de ENARGAS.");
      return;
    }
    const data = await extractEnargasData(tab.id);
    setStatus("Buscando la planilla abierta...");
    const count = await fillRegistro(data);
    setStatus(count
      ? `Listo. Se completaron ${count} dato/s.`
      : "No encontré la planilla abierta. Abrila y permití acceso a archivos si usás file://.");
  } catch (error) {
    setStatus(error.message || "No pude importar los datos.");
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    const text = await getCurrentEnargasText();
    await navigator.clipboard.writeText(text);
    setStatus("Texto copiado.");
  } catch (error) {
    setStatus(error.message || "No pude copiar el texto.");
  }
});
