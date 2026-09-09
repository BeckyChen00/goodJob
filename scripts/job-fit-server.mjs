import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const HOST = "127.0.0.1";
const PORT = 8765;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_JD_CHARS = 60000;
const MAX_RESUME_CHARS = 18000;

const RESUME_ROUTES = {
  产品: "C:\\Users\\37116\\Documents\\Codex\\2026-08-27\\zhe-g\\outputs\\resume_chen_ru.html",
  研发: "C:\\Users\\37116\\Documents\\Codex\\2026-08-27\\zhe-g\\outputs\\agent开发简历.html",
  测试: "C:\\Users\\37116\\Documents\\Codex\\2026-08-27\\zhe-g\\outputs\\agent测开简历.html",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let settled = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (settled) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        settled = true;
        reject(new Error("请求体过大，请缩短页面内容后重试。"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (settled) return;
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("请求体不是有效 JSON。"));
      }
    });
    request.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function htmlToText(value) {
  return normalizeText(String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "));
}

function classifyJobTitle(value) {
  const text = normalizeText(value).toLowerCase();
  if (/测试|测开|qa|质量|评测|test/.test(text)) return "测试";
  if (/产品|pm|product/.test(text)) return "产品";
  return "研发";
}

async function loadResume(kind) {
  const path = RESUME_ROUTES[kind] || RESUME_ROUTES.研发;
  const html = await readFile(path, "utf8");
  return { path, text: htmlToText(html).slice(0, MAX_RESUME_CHARS) };
}

function pickJobDescription(payload) {
  const pageContext = payload.pageContext || {};
  const jobDescription = payload.jobDescription || {};
  const form = payload.form || {};
  const candidates = [
    pageContext.text,
    jobDescription.text,
    form.notes,
    pageContext.html,
    jobDescription.html,
  ];
  for (const candidate of candidates) {
    const text = htmlToText(candidate);
    if (text) return text.slice(0, MAX_JD_CHARS);
  }
  return "";
}

function buildPrompt({ payload, kind, resume, jd }) {
  const form = payload.form || {};
  const pageContext = payload.pageContext || {};
  const title = normalizeText(form.jobTitle || payload.jobDescription?.jobTitle || pageContext.title);
  const companyName = normalizeText(form.companyName || payload.jobDescription?.companyName);
  const sourceUrl = normalizeText(form.sourceUrl || payload.jobDescription?.sourceUrl || pageContext.url);

  return [
    "你是校招岗位-简历匹配评测 Agent。请根据候选人简历事实与岗位 JD 证据，判断这个岗位是否值得投递。",
    "严格要求：不要编造经历；没有证据就写“简历未体现”；结论要服务于投递决策和面试准备。",
    "输出结构：1. 结论与总分/100；2. 岗位画像；3. 匹配维度评分表；4. 核心优势；5. 短板和面试风险；6. 简历优化建议。",
    "",
    `岗位类型判断：${kind}`,
    `使用简历路由：${resume.path}`,
    `公司：${companyName || "未知"}`,
    `岗位：${title || "未知"}`,
    `地点：${normalizeText(form.location || payload.jobDescription?.location) || "未知"}`,
    `批次：${normalizeText(form.batch || payload.jobDescription?.batch) || "未知"}`,
    `投递状态：${normalizeText(form.jobStatus || payload.jobDescription?.jobStatus) || "未知"}`,
    `链接：${sourceUrl || "未知"}`,
    "",
    "候选人简历文本：",
    resume.text,
    "",
    "岗位 JD / 页面正文文本：",
    jd || "未读取到 JD，请基于岗位标题和已填信息谨慎分析，并明确指出信息不足。",
  ].join("\n");
}

async function buildJobFitPayload(payload) {
  const jd = pickJobDescription(payload);
  const textForClassification = [
    payload.form?.jobTitle,
    payload.jobDescription?.jobTitle,
    payload.pageContext?.title,
    jd,
    payload.form?.notes,
    payload.form?.sourceUrl,
    payload.pageContext?.url,
  ].map(normalizeText).join(" ");
  const kind = classifyJobTitle(textForClassification);
  const resume = await loadResume(kind);
  return {
    ok: true,
    kind,
    resumePath: resume.path,
    jdChars: jd.length,
    jdPreview: jd.slice(0, 500),
    prompt: buildPrompt({ payload, kind, resume, jd }),
  };
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }
  if (request.method !== "POST" || request.url !== "/job-fit") {
    sendJson(response, 404, { ok: false, error: "仅支持 POST /job-fit。" });
    return;
  }
  try {
    sendJson(response, 200, await buildJobFitPayload(await readJson(request)));
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message || "岗位匹配 prompt 构造失败。" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Job fit prompt server listening at http://${HOST}:${PORT}/job-fit`);
});
