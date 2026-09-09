import assert from "node:assert/strict";
import test from "node:test";
import { fillWithAi, mapResumeFieldsWithAi, parseAiResponse, PROVIDERS } from "../src/ai.js";

test("DeepSeek is the default fixed provider", () => {
  assert.equal(PROVIDERS.deepseek.baseUrl, "https://api.deepseek.com");
  assert.equal(PROVIDERS.deepseek.defaultModel, "deepseek-chat");
});

test("AI JSON is reduced to editable form fields", () => {
  assert.deepEqual(parseAiResponse('```json\n{"companyName":" 字节跳动 ","jobTitle":"测试开发","ignored":"x"}\n```'), {
    companyName: "字节跳动",
    companyShortName: "",
    companyWebsite: "",
    jobTitle: "测试开发",
    location: "",
    batch: "",
    sourceUrl: "",
    notes: "",
  });
  assert.throws(() => parseAiResponse("nope"), /有效 JSON/);
});

test("empty AI JSON is reported as a failed extraction instead of success", () => {
  assert.throws(
    () => parseAiResponse('{"companyName":"","jobTitle":"","notes":""}'),
    /没有识别出可填写字段/,
  );
});

test("AI call requires key and sends visible page text plus HTML", async () => {
  await assert.rejects(() => fillWithAi({ settings: { provider: "deepseek", apiKey: "" }, pageContext: {} }), /API Key/);
  let request;
  const result = await fillWithAi({
    settings: { provider: "deepseek", apiKey: "secret", model: "deepseek-chat" },
    pageContext: {
      url: "https://jobs.example/1",
      title: "AI搜推产品经理",
      text: "职位描述 负责 AI 搜索推荐产品化落地",
      html: "<main>JD HTML</main>",
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"companyName":"Example","jobTitle":"AI搜推产品经理"}' } }] }) };
    },
  });
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer secret");
  assert.match(request.options.body, /职位描述 负责 AI 搜索推荐产品化落地/);
  assert.match(request.options.body, /<main>JD HTML<\/main>/);
  assert.equal(result.jobTitle, "AI搜推产品经理");
});

test("resume AI mapping sends keys but never profile values", async () => {
  let body;
  const mapping = await mapResumeFieldsWithAi({
    settings: { provider: "deepseek", apiKey: "secret" },
    fields: [{ key: "name:email", label: "邮箱", type: "text", options: [] }],
    profileKeys: ["联系方式.邮箱"],
    fetchImpl: async (_url, options) => {
      body = options.body;
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"name:email":"联系方式.邮箱","bad":"x"}' } }] }) };
    },
  });
  assert.deepEqual(mapping, { "name:email": "联系方式.邮箱" });
  assert.match(body, /联系方式\.邮箱/);
  assert.doesNotMatch(body, /someone@example\.com/);
});
