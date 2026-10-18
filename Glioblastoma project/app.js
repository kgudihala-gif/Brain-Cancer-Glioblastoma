const PXYEDA_PREDICT_URL = "https://askai.aiclub.world/490cba62-d1ba-4a5c-af77-d0dae6ab7e19";
const SETTINGS_STORAGE_KEY = "afterscan-display-preferences";
const AI_LOG_STORAGE_KEY = "afterscan-openai-logs";

const pageElements = Array.from(document.querySelectorAll("[data-page]"));
const navLinks = Array.from(document.querySelectorAll("[data-page-link]"));
const chooseButton = document.querySelector("#choose-image");
const chooseButtonLabel = document.querySelector("#choose-button-label");
const imageInput = document.querySelector("#mri-image");
const uploadStatus = document.querySelector("#upload-status");
const resultPlaceholder = document.querySelector("#result-placeholder");
const resultStatus = document.querySelector("#result-status");
const resultContent = document.querySelector("#result-content");
const rawResponseDetails = document.querySelector("#raw-response-details");
const rawResponse = document.querySelector("#raw-response");
const guidanceBlock = document.querySelector("#guidance-block");
const guidanceStatus = document.querySelector("#guidance-status");
const guidanceOutput = document.querySelector("#guidance-output");
const guidanceRetry = document.querySelector("#guidance-retry");
const aiLogList = document.querySelector("#ai-log-list");
const aiLogEmpty = document.querySelector("#ai-log-empty");
const aiLogStatus = document.querySelector("#ai-log-status");
const clearAiLogButton = document.querySelector("#clear-ai-log");

const settingsControls = {
  largeText: document.querySelector("#setting-large-text"),
  highContrast: document.querySelector("#setting-high-contrast"),
  reducedMotion: document.querySelector("#setting-reduced-motion"),
};

let selectedImageFile = null;
let analysisInProgress = false;
let activeAnalysis = 0;
let activeGuidance = 0;
let lastGuidanceResponse = null;
let aiLogs = readAiLogs();

function currentPageName() {
  const name = window.location.hash.slice(1);
  return pageElements.some((page) => page.dataset.page === name) ? name : "intro";
}

function renderPage({ focusHeading = false } = {}) {
  const current = currentPageName();
  for (const page of pageElements) {
    page.hidden = page.dataset.page !== current;
  }
  for (const link of navLinks) {
    if (link.dataset.pageLink === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (focusHeading) {
    window.scrollTo({ top: 0, behavior: document.documentElement.classList.contains("is-reduced-motion") ? "auto" : "smooth" });
    document.querySelector(`[data-page="${current}"] h1`)?.focus({ preventScroll: true });
  }
}

function readAiLogs() {
  try {
    const entries = JSON.parse(localStorage.getItem(AI_LOG_STORAGE_KEY) || "[]");
    return Array.isArray(entries)
      ? entries.filter((entry) => entry && typeof entry.timestamp === "string" && typeof entry.model === "string")
      : [];
  } catch {
    return [];
  }
}

function renderAiLogs() {
  aiLogList.replaceChildren(...aiLogs.map((entry) => {
    const item = document.createElement("li");
    item.className = "ai-log-entry";

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const model = document.createElement("strong");
    model.className = "ai-log-model";
    model.textContent = entry.model;
    const time = document.createElement("time");
    time.className = "ai-log-time";
    time.dateTime = entry.timestamp;
    const date = new Date(entry.timestamp);
    time.textContent = Number.isNaN(date.valueOf()) ? entry.timestamp : date.toLocaleString();
    const status = document.createElement("span");
    status.className = "ai-log-response-status";
    status.textContent = entry.response?.status ? `HTTP ${entry.response.status}` : "No response";
    summary.append(model, time, status);
    details.append(summary);

    const utc = document.createElement("p");
    utc.className = "ai-log-utc";
    utc.textContent = `UTC · ${entry.timestamp}`;
    details.append(utc);

    for (const [title, value] of [["Request", entry.request], ["Response", entry.response]]) {
      const section = document.createElement("section");
      section.className = "ai-log-payload";
      const heading = document.createElement("h2");
      heading.textContent = title;
      const pre = document.createElement("pre");
      pre.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2) || "Not available";
      section.append(heading, pre);
      details.append(section);
    }

    item.append(details);
    return item;
  }));
  aiLogEmpty.hidden = aiLogs.length > 0;
  clearAiLogButton.disabled = aiLogs.length === 0;
}

function addAiLog(entry) {
  if (!entry || typeof entry.timestamp !== "string" || typeof entry.model !== "string") return;
  aiLogs.unshift(entry);
  renderAiLogs();
  try {
    localStorage.setItem(AI_LOG_STORAGE_KEY, JSON.stringify(aiLogs));
    aiLogStatus.textContent = "";
  } catch {
    aiLogStatus.textContent = "This log could not be saved in this browser.";
  }
}

function clearAiLogs() {
  aiLogs = [];
  try {
    localStorage.removeItem(AI_LOG_STORAGE_KEY);
    aiLogStatus.textContent = "Log cleared.";
  } catch {
    aiLogStatus.textContent = "Could not clear the saved log.";
  }
  renderAiLogs();
}

window.addEventListener("storage", (event) => {
  if (event.key !== AI_LOG_STORAGE_KEY) return;
  aiLogs = readAiLogs();
  renderAiLogs();
});

if (!window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#intro`);
renderPage();
renderAiLogs();
window.addEventListener("hashchange", () => renderPage({ focusHeading: true }));

function displayValue(value) {
  if (value === undefined || value === null || value === "") return "Not returned";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function setText(selector, value) {
  document.querySelector(selector).textContent = displayValue(value);
}

function getResponseFields(payload) {
  let body = payload?.body ?? payload;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = payload; }
  }
  return body && typeof body === "object" && !Array.isArray(body) ? body : payload;
}

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const comma = dataUrl.indexOf(",");
      if (comma < 0) reject(new Error("The selected image could not be encoded."));
      else resolve(dataUrl.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

function showResultPlaceholder(title, message) {
  resultContent.hidden = true;
  resultPlaceholder.hidden = false;
  resultPlaceholder.querySelector("h2").textContent = title;
  resultStatus.textContent = message;
}

function showResultContent({ label, score, model, httpStatus, responseText, isError = false }) {
  resultPlaceholder.hidden = true;
  resultContent.hidden = false;
  setText("#prediction-label", label ?? (isError ? "No result received" : "No label returned"));
  setText("#prediction-score", score);
  setText("#prediction-model", model);

  document.querySelector("#http-status").textContent = httpStatus || "No response";
  rawResponse.textContent = responseText || "No service response was received.";
  rawResponseDetails.hidden = !responseText;
  rawResponseDetails.open = false;
}

function resetGuidance() {
  activeGuidance += 1;
  lastGuidanceResponse = null;
  guidanceBlock.hidden = true;
  guidanceOutput.hidden = true;
  guidanceRetry.hidden = true;
  guidanceStatus.textContent = "";
  document.querySelector("#guidance-message").textContent = "";
  document.querySelector("#guidance-steps").replaceChildren();
  document.querySelector("#guidance-resources").replaceChildren();
}

function renderGuidance(guidance) {
  document.querySelector("#guidance-message").textContent = guidance.friendly_message;
  const steps = document.querySelector("#guidance-steps");
  steps.replaceChildren(...guidance.next_steps.map((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    return item;
  }));

  const resourceList = document.querySelector("#guidance-resources");
  resourceList.replaceChildren(...guidance.resources.map((resource) => {
    if (!resource || typeof resource.name !== "string" || typeof resource.url !== "string") return null;
    let url;
    try { url = new URL(resource.url); } catch { return null; }
    if (url.protocol !== "https:") return null;

    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const text = document.createElement("span");
    text.append(document.createTextNode(resource.name));
    if (typeof resource.description === "string") {
      const description = document.createElement("small");
      description.textContent = resource.description;
      text.append(description);
    }
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    link.append(text, arrow);
    item.append(link);
    return item;
  }).filter(Boolean));

  guidanceOutput.hidden = false;
  guidanceStatus.textContent = "Guidance is ready.";
  guidanceRetry.hidden = true;
}

async function requestGuidance(pyxedaResponse, thisAnalysis = activeAnalysis) {
  if (thisAnalysis !== activeAnalysis || typeof pyxedaResponse?.predicted_label !== "string") return;
  lastGuidanceResponse = pyxedaResponse;
  const thisGuidance = ++activeGuidance;
  guidanceBlock.hidden = false;
  guidanceOutput.hidden = true;
  guidanceRetry.hidden = true;
  guidanceStatus.textContent = "Getting guidance…";

  try {
    const response = await fetch("/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pyxeda_response: pyxedaResponse }),
      signal: AbortSignal.timeout(35_000),
    });
    const payload = await response.json().catch(() => null);
    if (payload?.llm_log) addAiLog(payload.llm_log);
    if (!response.ok || !payload?.guidance) throw new Error("Guidance is unavailable.");
    if (thisGuidance !== activeGuidance || thisAnalysis !== activeAnalysis) return;

    const guidance = payload.guidance;
    if (typeof guidance.friendly_message !== "string"
      || !Array.isArray(guidance.next_steps)
      || !Array.isArray(guidance.resources)) throw new Error("Guidance could not be read.");
    renderGuidance(guidance);
  } catch {
    if (thisGuidance !== activeGuidance || thisAnalysis !== activeAnalysis) return;
    guidanceStatus.textContent = "Guidance isn’t ready. Your result is still here.";
    guidanceRetry.hidden = false;
  }
}

async function analyzeImage(file) {
  if (analysisInProgress || !file) return;
  if (!file.type.startsWith("image/")) {
    uploadStatus.textContent = "Choose an image file.";
    return;
  }

  selectedImageFile = file;
  const thisAnalysis = ++activeAnalysis;
  resetGuidance();
  analysisInProgress = true;
  chooseButton.disabled = true;
  chooseButton.setAttribute("aria-busy", "true");
  chooseButtonLabel.textContent = "Sending image…";
  uploadStatus.textContent = "Sending to Pyxeda…";
  showResultPlaceholder("Analyzing image…", "");

  try {
    const base64Image = await fileAsBase64(file);
    const response = await fetch(PXYEDA_PREDICT_URL, {
      method: "POST",
      body: new Blob([base64Image]),
      signal: AbortSignal.timeout(60_000),
    });
    const responseText = await response.text();
    if (thisAnalysis !== activeAnalysis) return;
    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = null;
    }

    const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
    if (!response.ok) {
      showResultContent({
        label: "Analysis unavailable",
        message: getResponseFields(payload)?.Message ?? getResponseFields(payload)?.message,
        httpStatus: status,
        responseText: payload ? JSON.stringify(payload, null, 2) : responseText,
        isError: true,
      });
      uploadStatus.textContent = "Pyxeda could not analyze this image. Select it to try again.";
    } else if (!payload) {
      showResultContent({
        label: "Response received",
        message: "The service response was not JSON.",
        httpStatus: status,
        responseText: responseText || "The service returned an empty response.",
        isError: true,
      });
      uploadStatus.textContent = "Pyxeda returned data the app could not read.";
    } else {
      const fields = getResponseFields(payload);
      const label = fields.predicted_label ?? fields.predictedLabel ?? payload.predicted_label ?? payload.predictedLabel;
      const score = fields.score ?? payload.score;
      const model = fields.Model ?? fields.model ?? payload.Model ?? payload.model;
      const message = fields.Message ?? fields.message ?? payload.Message ?? payload.message;
      showResultContent({
        label,
        score,
        model,
        message,
        httpStatus: status,
        responseText: JSON.stringify(payload, null, 2),
      });
      uploadStatus.textContent = "Done.";
      if (typeof label === "string" && label.trim()) {
        const pyxedaResponse = { predicted_label: label.trim() };
        if (score !== undefined) pyxedaResponse.score = score;
        if (model !== undefined) pyxedaResponse.Model = model;
        if (message !== undefined) pyxedaResponse.Message = message;
        void requestGuidance(pyxedaResponse, thisAnalysis);
      }
    }
    window.location.hash = "app";
  } catch (error) {
    if (thisAnalysis !== activeAnalysis) return;
    const timedOut = error?.name === "TimeoutError";
    const message = timedOut
      ? "Request timed out. Select the image to try again."
      : "Connection failed. Select the image to try again.";
    showResultContent({
      label: timedOut ? "Request timed out" : "Connection issue",
      message,
      httpStatus: "No response",
      responseText: error?.message || "Network request failed.",
      isError: true,
    });
    uploadStatus.textContent = message;
    window.location.hash = "app";
  } finally {
    if (thisAnalysis === activeAnalysis) {
      analysisInProgress = false;
      chooseButton.disabled = false;
      chooseButton.removeAttribute("aria-busy");
      chooseButtonLabel.textContent = selectedImageFile ? "Choose another image" : "Choose MRI image";
    }
  }
}

chooseButton.addEventListener("click", () => {
  if (chooseButton.disabled) return;
  imageInput.value = "";
  imageInput.click();
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (file) analyzeImage(file);
});

function clearSession() {
  activeAnalysis += 1;
  resetGuidance();
  analysisInProgress = false;
  chooseButton.disabled = false;
  chooseButton.removeAttribute("aria-busy");
  selectedImageFile = null;
  imageInput.value = "";
  chooseButtonLabel.textContent = "Choose MRI image";
  uploadStatus.textContent = "";
  showResultPlaceholder("Your result will appear here.", "");
  resultPlaceholder.querySelector("h2").textContent = "Your result will appear here.";
  document.querySelector("#prediction-label").textContent = "—";
  document.querySelector("#prediction-score").textContent = "—";
  document.querySelector("#prediction-model").textContent = "—";
  document.querySelector("#http-status").textContent = "—";
  rawResponse.textContent = "";
  rawResponseDetails.open = false;
  rawResponseDetails.hidden = true;
  document.querySelector("#clear-status").textContent = "Cleared.";
}

document.querySelector("#clear-session").addEventListener("click", clearSession);
guidanceRetry.addEventListener("click", () => {
  if (lastGuidanceResponse) void requestGuidance(lastGuidanceResponse, activeAnalysis);
});
clearAiLogButton.addEventListener("click", clearAiLogs);

function applyPreferences(preferences) {
  document.documentElement.classList.toggle("is-large-text", Boolean(preferences.largeText));
  document.documentElement.classList.toggle("is-high-contrast", Boolean(preferences.highContrast));
  document.documentElement.classList.toggle("is-reduced-motion", Boolean(preferences.reducedMotion));
  for (const [name, input] of Object.entries(settingsControls)) input.checked = Boolean(preferences[name]);
}

function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function savePreferences() {
  const preferences = Object.fromEntries(Object.entries(settingsControls).map(([name, input]) => [name, input.checked]));
  applyPreferences(preferences);
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    document.querySelector("#clear-status").textContent = "Could not save preferences.";
  }
}

applyPreferences(readPreferences());
for (const input of Object.values(settingsControls)) input.addEventListener("change", savePreferences);
