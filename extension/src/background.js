/* global chrome */
import { fillWithAi } from "./ai.js";
import { loadSettings, savePageTask } from "./storage.js";

async function toggleDrawer(tab) {
  if (!tab?.id) return;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_APPLICATION_DRAWER" });
    if (!response?.drawerHandled) throw new Error("Drawer handler is not installed.");
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/drawer.js"] });
      const response = await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_APPLICATION_DRAWER" });
      if (!response?.drawerHandled) throw new Error("Drawer handler did not respond.");
    } catch {
      await chrome.action.setBadgeBackgroundColor({ color: "#9a4137", tabId: tab.id });
      await chrome.action.setBadgeText({ text: "!", tabId: tab.id });
      setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 1800);
    }
  }
}

chrome.action.onClicked.addListener(toggleDrawer);

async function handleAiFill(pageContext) {
  const url = String(pageContext?.url || "");
  await savePageTask(url, { status: "processing", startedAt: new Date().toISOString() });
  try {
    const values = await fillWithAi({ settings: await loadSettings(), pageContext });
    await savePageTask(url, { status: "completed", values, completedAt: new Date().toISOString() });
  } catch (error) {
    await savePageTask(url, { status: "failed", message: error?.message || "AI 填写失败，请重试。", completedAt: new Date().toISOString() });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_AI_FILL") {
    handleAiFill(message.pageContext);
    sendResponse({ accepted: true });
    return false;
  }
  return false;
});
