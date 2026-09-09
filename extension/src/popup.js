/* global chrome */
import { mapResumeFieldsWithAi } from "./ai.js";
import { classifyPageContext, createDraft } from "./domain.js";
import { streamJobFit } from "./job-fit.js";
import { fetchRepositoryResume } from "./resume-repository.js";
import { mountResumeDrawer } from "../resume-ui/resume-profile.js";
import {
  clearPageCache,
  listDrafts,
  loadPageCache,
  loadSettings,
  markDraftForRetry,
  removeDraft,
  saveDraft,
  savePageForm,
  savePageJobFitTask,
  saveSettings,
} from "./storage.js";
import { sendDraftToApp } from "./sync.js";

const form = document.querySelector("#capture-form");
const feedback = document.querySelector("#feedback");
const queue = document.querySelector("#queue");
const aiButton = document.querySelector("#ai-fill");
const jobFitButton = document.querySelector("#job-fit");
const jobFitDialog = document.querySelector("#job-fit-dialog");
const jobFitCommand = document.querySelector("#job-fit-command");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsForm = document.querySelector("#settings-form");
const successDialog = document.querySelector("#success-dialog");
const jobFields = document.querySelector("#job-fields");
const closeDrawerButton = document.querySelector("#close-drawer");
const drawerMode = new URLSearchParams(location.search).get("mode") === "drawer";

document.documentElement.dataset.mode = drawerMode ? "drawer" : "popup";
closeDrawerButton.hidden = !drawerMode;
closeDrawerButton.addEventListener("click", () => {
  window.parent.postMessage({ source: "goodjob-drawer", type: "CLOSE_DRAWER" }, "*");
});

let pageContext = { url: "", title: "", domain: "", html: "", text: "" };
let pollTimer;

const show = (message, kind = "info") => {
  feedback.textContent = message;
  feedback.dataset.kind = kind;
};
const field = (name) => form.elements.namedItem(name);
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const formValues = () => Object.fromEntries(new FormData(form));
const openDialog = (dialog) => {
  if (!dialog.open) dialog.showModal();
};

function requestPageContextFromDrawer() {
  if (!drawerMode) return Promise.resolve(null);
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      window.removeEventListener("message", receive);
      resolve(null);
    }, 1200);
    function receive(event) {
      if (event.data?.source !== "goodjob-drawer" || event.data?.type !== "PAGE_CONTEXT" || event.data?.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      resolve(event.data.context || null);
    }
    window.addEventListener("message", receive);
    window.parent.postMessage({ source: "goodjob-drawer", type: "REQUEST_PAGE_CONTEXT", requestId }, "*");
  });
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("无法读取当前网页。");
  return tab;
}

async function ensureContentScript(tab) {
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_PAGE_CONTEXT" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] });
  }
}

async function activeResumeTab() {
  const tab = await currentTab();
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_RESUME_FIELDS" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] });
  }
  return tab;
}

const profileArea = chrome.storage.local;
const profileKey = "resumeProfileFields";
const resumeStore = {
  async load() {
    const stored = await profileArea.get(profileKey);
    const saved = Array.isArray(stored[profileKey]) ? stored[profileKey] : [];
    const known = new Set(saved.map((item) => item.key));
    try {
      const repository = await fetchRepositoryResume(fetch, chrome.runtime.getURL("resume-data/resume-profile.json"));
      for (const item of repository.fields) {
        if (!known.has(item.label)) {
          saved.push({ id: crypto.randomUUID(), key: item.label, value: item.value, source: "项目仓库", type: "文本" });
          known.add(item.label);
        }
      }
    } catch (error) {
      show(error.message || "仓库简历模板加载失败。", "warning");
    }
    try {
      const tab = await activeResumeTab();
      const extracted = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_RESUME_FIELDS" });
      for (const item of extracted.fields || []) {
        const key = item.label || item.key;
        if (key && !known.has(key)) {
          saved.push({ id: crypto.randomUUID(), key, value: "", source: "当前网页", type: item.customKind || item.type || "文本" });
          known.add(key);
        }
      }
    } catch (error) {
      show(error.message || "当前页面字段提取失败，可手工维护简历字段。", "warning");
    }
    return saved;
  },
  async save(fields) {
    await profileArea.set({ [profileKey]: fields });
    return fields;
  },
};

const resumeDrawer = mountResumeDrawer({
  store: resumeStore,
  onFill: async (profile) => {
    const tab = await activeResumeTab();
    const extracted = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_RESUME_FIELDS" });
    const settings = await loadSettings();
    const aiMapping = await mapResumeFieldsWithAi({ settings, fields: extracted.fields || [], profileKeys: profile.map((item) => item.key) });
    const result = await chrome.tabs.sendMessage(tab.id, { type: "FILL_RESUME_FIELDS", profile, aiMapping });
    if (!result?.filled?.length) throw new Error("没有找到可匹配字段，请按网页字段标签调整 key。");
    show(`已填入 ${result.filled.length} 个简历字段，请逐项审核。`, "success");
  },
});

async function capture() {
  try {
    const bridged = await requestPageContextFromDrawer();
    if (bridged) return classifyPageContext(bridged);
    const tab = await currentTab();
    const initial = classifyPageContext({ url: tab.url, title: tab.title });
    if (!initial.ok) return initial;
    await ensureContentScript(tab);
    const detail = await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_PAGE_CONTEXT" });
    return classifyPageContext(detail);
  } catch {
    return { ok: false, message: "当前页面无采集权限，请手动填写企业和岗位信息。" };
  }
}

async function refreshPageContext() {
  const result = await capture();
  if (!result.ok) throw new Error(result.message);
  pageContext = result.context;
  populate({ sourceUrl: pageContext.url, jobTitle: pageContext.title }, false);
  return pageContext;
}

async function render() {
  try {
    const items = await listDrafts();
    queue.innerHTML = items.length
      ? items.map((draft) => `<li><strong>${esc(draft.company.name)}</strong><span>${esc(draft.job?.title || "仅企业")}</span><small>发送失败 · 已重试 ${draft.attemptCount} 次</small><div><button data-action="retry" data-id="${draft.id}" type="button">重新发送</button><button data-action="delete" data-id="${draft.id}" type="button">删除</button></div></li>`).join("")
      : '<li class="empty">暂无发送失败的草稿</li>';
  } catch (error) {
    show(error.message, "error");
  }
}

function applyMode(mode) {
  const companyOnly = mode === "company-only";
  const radio = form.querySelector(`input[name="entryMode"][value="${mode}"]`);
  if (radio) radio.checked = true;
  jobFields.disabled = companyOnly;
  field("jobTitle").required = !companyOnly;
}

function populate(values, overwrite = true) {
  for (const [name, value] of Object.entries(values || {})) {
    if (field(name) && value && (overwrite || !field(name).value)) field(name).value = value;
  }
  if (values?.entryMode) applyMode(values.entryMode);
}

function populateAi(values) {
  const editable = { ...(values || {}) };
  delete editable.jobStatus;
  populate({ ...editable, entryMode: editable.jobTitle ? "company-job" : "company-only" });
}

async function restoreCache() {
  const cache = await loadPageCache(pageContext.url);
  if (cache?.form) populate(cache.form);
  const task = cache?.task;
  if (task?.status === "completed") {
    populateAi(task.values);
    await savePageForm(pageContext.url, formValues());
    aiButton.disabled = false;
    show("AI 结果已恢复，请检查后手动提交。", "success");
  } else if (task?.status === "processing") {
    aiButton.disabled = true;
    show("AI 正在后台处理，切换页面不会丢失。");
    pollTimer = setInterval(checkTask, 700);
  } else if (task?.status === "failed") {
    show(task.message || "AI 填写失败，请重试。", "error");
  }
  renderJobFitTask(cache?.jobFitTask);
}

async function checkTask() {
  const task = (await loadPageCache(pageContext.url))?.task;
  if (task?.status === "processing") return;
  clearInterval(pollTimer);
  pollTimer = null;
  aiButton.disabled = false;
  if (task?.status === "completed") {
    populateAi(task.values);
    await savePageForm(pageContext.url, formValues());
    show("AI 已填写表单，请检查后手动提交。", "success");
  } else if (task?.status === "failed") {
    show(task.message || "AI 填写失败，请重试。", "error");
  }
}

function renderJobFitTask(task) {
  if (!task) return;
  jobFitCommand.value = task.output || task.message || "";
  if (task.status === "streaming") show("岗位匹配正在流式生成。", "success");
  else if (task.status === "completed") show("岗位匹配已完成。", "success");
  else if (task.status === "failed") show(task.message || "岗位匹配失败。", "error");
}

form.addEventListener("input", (event) => {
  if (event.target?.name === "entryMode") applyMode(event.target.value);
  if (pageContext.url) savePageForm(pageContext.url, formValues());
});

document.querySelector("#maintain-resume").addEventListener("click", () => resumeDrawer.open());
document.querySelector("#open-settings").addEventListener("click", async () => {
  const settings = await loadSettings();
  settingsForm.elements.provider.value = settings.provider;
  settingsForm.elements.apiKey.value = settings.apiKey;
  settingsForm.elements.model.value = settings.model;
  settingsDialog.showModal();
});
document.querySelector("#cancel-settings").addEventListener("click", () => settingsDialog.close());
document.querySelector("#close-success").addEventListener("click", () => successDialog.close());
settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings(Object.fromEntries(new FormData(settingsForm)));
  settingsDialog.close();
  show("AI 设置已保存。", "success");
});

jobFitButton.addEventListener("click", async () => {
  const settings = await loadSettings();
  let output = "";
  let lastSaveAt = 0;
  try {
    jobFitButton.disabled = true;
    await refreshPageContext();
    openDialog(jobFitDialog);
    jobFitCommand.value = "已提交到本地服务，正在等待 LLM 返回首个 token...";
    await savePageForm(pageContext.url, formValues());
    await savePageJobFitTask(pageContext.url, { status: "streaming", output: jobFitCommand.value, updatedAt: new Date().toISOString() });
    await streamJobFit({
      settings,
      pageContext,
      form: formValues(),
      onToken: async (token) => {
        output += token;
        jobFitCommand.value = output;
        jobFitCommand.scrollTop = jobFitCommand.scrollHeight;
        const now = Date.now();
        if (now - lastSaveAt > 700) {
          lastSaveAt = now;
          await savePageJobFitTask(pageContext.url, { status: "streaming", output, updatedAt: new Date().toISOString() });
        }
      },
    });
    await savePageJobFitTask(pageContext.url, { status: "completed", output, completedAt: new Date().toISOString() });
    show("岗位匹配已完成。", "success");
  } catch (error) {
    const message = error.message || "岗位匹配失败，请确认本地服务已启动。";
    jobFitCommand.value = output ? `${output}\n\n[错误] ${message}` : message;
    await savePageJobFitTask(pageContext.url, { status: "failed", output, message, completedAt: new Date().toISOString() });
    show(message, "error");
  } finally {
    jobFitButton.disabled = false;
  }
});

document.querySelector("#copy-job-fit").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(jobFitCommand.value);
  } catch {
    jobFitCommand.focus();
    jobFitCommand.select();
    document.execCommand("copy");
  }
  show("岗位匹配结果已复制。", "success");
});

aiButton.addEventListener("click", async () => {
  aiButton.disabled = true;
  show("AI 已载入后台处理，切换页面不会丢失...");
  try {
    await refreshPageContext();
    await savePageForm(pageContext.url, formValues());
    const response = await chrome.runtime.sendMessage({ type: "START_AI_FILL", pageContext });
    if (!response?.accepted) throw new Error("AI 后台任务未被接收，请重新加载扩展后重试。");
    pollTimer = setInterval(checkTask, 700);
  } catch (error) {
    aiButton.disabled = false;
    show(error.message || "AI 任务启动失败。", "error");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let draft;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    draft = createDraft({ ...formValues(), ...pageContext });
    show("正在添加到投递台...");
    await sendDraftToApp(draft);
    await clearPageCache(pageContext.url);
    successDialog.showModal();
    show("已提交。", "success");
  } catch (error) {
    if (draft) await saveDraft(draft);
    show(`${error.message || "发送失败"} 草稿已保留，可稍后重新发送。`, "error");
    await render();
  } finally {
    submit.disabled = false;
  }
});

queue.addEventListener("click", async (event) => {
  const button = event.target instanceof Element ? event.target.closest("button[data-action]") : null;
  if (!button) return;
  try {
    if (button.dataset.action === "delete") await removeDraft(button.dataset.id);
    else {
      const draft = (await listDrafts()).find((item) => item.id === button.dataset.id);
      if (!draft) return;
      await markDraftForRetry(draft.id);
      await sendDraftToApp(draft);
      await removeDraft(draft.id);
      successDialog.showModal();
    }
    await render();
  } catch (error) {
    show(error.message || "重新发送失败。", "error");
    await render();
  }
});

applyMode("company-job");
const result = await capture();
if (result.ok) {
  pageContext = result.context;
  populate({ sourceUrl: pageContext.url, jobTitle: pageContext.title }, false);
  await restoreCache();
  if (!(await loadPageCache(pageContext.url))?.task) {
    show(result.warning || `已读取 ${pageContext.domain}，正文 ${pageContext.text.length} 字。`, result.warning ? "warning" : "success");
  }
} else {
  show(result.message, "warning");
}
await render();
