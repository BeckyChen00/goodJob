/* global chrome */
import { deleteDraft, retryDraft, upsertDraft } from "./domain.js";

const KEY = "capturedApplicationDrafts";
const SETTINGS_KEY = "aiSettings";
const PAGE_CACHE_KEY = "pageCaches";

function area() {
  if (!globalThis.chrome?.storage?.local) throw new Error("浏览器本地存储不可用，请检查扩展权限。");
  return chrome.storage.local;
}

export async function listDrafts() {
  const value = await area().get(KEY);
  return Array.isArray(value[KEY]) ? value[KEY] : [];
}

async function write(items) {
  await area().set({ [KEY]: items });
  return items;
}

export async function saveDraft(draft) {
  return write(upsertDraft(await listDrafts(), draft));
}

export async function removeDraft(id) {
  return write(deleteDraft(await listDrafts(), id));
}

export async function markDraftForRetry(id) {
  return write(retryDraft(await listDrafts(), id));
}

export async function loadSettings() {
  const value = await area().get(SETTINGS_KEY);
  return { provider: "deepseek", model: "deepseek-chat", apiKey: "", ...(value[SETTINGS_KEY] || {}) };
}

export async function saveSettings(settings) {
  const value = { provider: "deepseek", model: String(settings.model || "deepseek-chat").trim(), apiKey: String(settings.apiKey || "").trim() };
  await area().set({ [SETTINGS_KEY]: value });
  return value;
}

const pageKey = (url) => String(url || "").split("#")[0];

export async function loadPageCache(url) {
  const value = await area().get(PAGE_CACHE_KEY);
  return value[PAGE_CACHE_KEY]?.[pageKey(url)] || null;
}

async function updatePageCache(url, patch) {
  const value = await area().get(PAGE_CACHE_KEY);
  const all = value[PAGE_CACHE_KEY] || {};
  const key = pageKey(url);
  all[key] = { ...(all[key] || {}), ...patch, updatedAt: new Date().toISOString() };
  await area().set({ [PAGE_CACHE_KEY]: all });
  return all[key];
}

export async function savePageForm(url, form) {
  return updatePageCache(url, { form });
}

export async function savePageTask(url, task) {
  return updatePageCache(url, { task });
}

export async function savePageJobFitTask(url, jobFitTask) {
  return updatePageCache(url, { jobFitTask });
}

export async function clearPageCache(url) {
  const value = await area().get(PAGE_CACHE_KEY);
  const all = value[PAGE_CACHE_KEY] || {};
  delete all[pageKey(url)];
  await area().set({ [PAGE_CACHE_KEY]: all });
}

export class ApplicationSink {
  async save(draft) {
    await saveDraft(draft);
    return { accepted: true, draftId: draft.id };
  }
}
