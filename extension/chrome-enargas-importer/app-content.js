function importIntoRegistroGnc(text) {
  const textarea = document.getElementById("enargasText");
  const button = document.getElementById("importEnargasBtn");
  if (!textarea || !button) return false;

  textarea.value = text;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  document.dispatchEvent(new CustomEvent("registro-gnc:import-enargas", {
    detail: { text }
  }));
  if (typeof window.importEnargasText === "function") {
    window.importEnargasText();
  } else {
    button.click();
  }
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "IMPORT_ENARGAS_TEXT") return false;
  const ok = importIntoRegistroGnc(message.text || "");
  sendResponse({ ok });
  return false;
});
