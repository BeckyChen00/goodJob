export const JOB_FIT_ENDPOINT = "http://127.0.0.1:8765/job-fit";

export const PROVIDERS = {
  deepseek: { baseUrl: "https://api.deepseek.com", defaultModel: "deepseek-chat" },
};

const MAX_HTML_CHARS = 12000;
const MAX_TEXT_CHARS = 60000;

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function buildJobDescription({ pageContext = {}, form = {} } = {}) {
  return {
    companyName: normalizeText(form.companyName),
    jobTitle: normalizeText(form.jobTitle || pageContext.title),
    location: normalizeText(form.location),
    batch: normalizeText(form.batch),
    jobStatus: normalizeText(form.jobStatus),
    sourceUrl: normalizeText(form.sourceUrl || pageContext.url),
    pageTitle: normalizeText(pageContext.title),
    text: normalizeText(pageContext.text).slice(0, MAX_TEXT_CHARS),
    html: normalizeText(pageContext.html).slice(0, MAX_HTML_CHARS),
    notes: normalizeText(form.notes),
  };
}

export function classifyJobTitle(title) {
  const text = normalizeText(title).toLowerCase();
  if (/测试|测开|qa|质量|评测|test/.test(text)) return "测试";
  if (/产品|pm|product/.test(text)) return "产品";
  return "研发";
}

function parseDelta(line) {
  if (!line.startsWith("data:")) return "";
  const data = line.slice(5).trim();
  if (!data || data === "[DONE]") return "";
  try {
    return JSON.parse(data)?.choices?.[0]?.delta?.content || "";
  } catch {
    return "";
  }
}

async function buildPromptWithBackend({ pageContext, form, fetchImpl }) {
  const jobDescription = buildJobDescription({ pageContext, form });
  const response = await fetchImpl(JOB_FIT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pageContext: {
        ...pageContext,
        text: jobDescription.text,
        html: jobDescription.html,
      },
      form,
      jobDescription,
    }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: text };
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `岗位匹配服务请求失败：${response.status}`);
  }
  return { ...payload, jobDescription };
}

export async function streamJobFit({ settings, pageContext, form, onToken, fetchImpl = fetch }) {
  const provider = PROVIDERS[settings?.provider || "deepseek"];
  if (!provider) throw new Error("不支持的 AI 开发商。");
  const apiKey = String(settings?.apiKey || "").trim();
  if (!apiKey) throw new Error("请先在插件设置中填写 API Key。");

  const backend = await buildPromptWithBackend({ pageContext, form, fetchImpl });
  const header = [
    `岗位类型：${backend.kind}`,
    `简历路由：${backend.resumePath}`,
    backend.jdChars == null ? "" : `JD 字符数：${backend.jdChars}`,
    "",
    "",
  ].filter((line, index) => line || index >= 3).join("\n");
  onToken?.(header);

  const response = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: settings.model || provider.defaultModel,
      temperature: 0.2,
      stream: true,
      messages: [
        { role: "system", content: "你是严谨的应届生岗位匹配评测助手。只根据输入证据回答，使用中文。" },
        { role: "user", content: backend.prompt },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM 请求失败：${response.status}${text ? `：${text.slice(0, 200)}` : ""}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    onToken?.(text);
    return { output: `${header}${text}`, jobDescription: backend.jobDescription };
  }

  const decoder = new TextDecoder();
  let output = header;
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const token = parseDelta(line);
      if (token) {
        output += token;
        onToken?.(token);
      }
    }
  }
  return { output, jobDescription: backend.jobDescription };
}
