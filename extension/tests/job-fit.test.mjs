import assert from "node:assert/strict";
import test from "node:test";
import { buildJobDescription, classifyJobTitle, JOB_FIT_ENDPOINT, streamJobFit } from "../src/job-fit.js";

function streamFromStrings(parts) {
  const chunks = parts.map((part) => new TextEncoder().encode(part));
  return {
    getReader() {
      let index = 0;
      return {
        async read() {
          if (index >= chunks.length) return { done: true };
          return { done: false, value: chunks[index++] };
        },
      };
    },
  };
}

test("job titles are classified into product, test and development routes", () => {
  assert.equal(classifyJobTitle("校招-AI数据产品经理"), "产品");
  assert.equal(classifyJobTitle("AI测试开发工程师"), "测试");
  assert.equal(classifyJobTitle("Agent应用研发工程师"), "研发");
});

test("job description preserves form plus visible text and html for backend prompt", () => {
  const description = buildJobDescription({
    pageContext: {
      url: "https://jobs.example/detail",
      title: "页面标题",
      text: "职位描述：AI专项评测、工具调用、Badcase归因。",
      html: "<main>JD 内容</main>",
    },
    form: { companyName: "示例公司", jobTitle: "AI 测试开发工程师", location: "北京", batch: "2027届", jobStatus: "待投递" },
  });
  assert.equal(description.companyName, "示例公司");
  assert.equal(description.jobTitle, "AI 测试开发工程师");
  assert.equal(description.sourceUrl, "https://jobs.example/detail");
  assert.match(description.text, /AI专项评测/);
  assert.match(description.html, /JD 内容/);
});

test("job fit streams tokens after backend prompt construction", async () => {
  const requests = [];
  const chunksSeen = [];
  const result = await streamJobFit({
    settings: { provider: "deepseek", apiKey: "secret", model: "deepseek-chat" },
    pageContext: { url: "https://jobs.example/detail", title: "AI PM", text: "岗位 JD 正文", html: "<main>JD</main>" },
    form: { companyName: "Example" },
    onToken: (token) => chunksSeen.push(token),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url === JOB_FIT_ENDPOINT) {
        assert.match(options.body, /岗位 JD 正文/);
        assert.match(options.body, /<main>JD<\/main>/);
        return {
          ok: true,
          text: async () => JSON.stringify({ ok: true, kind: "产品", resumePath: "resume.html", jdChars: 7, prompt: "岗位匹配 prompt" }),
        };
      }
      return {
        ok: true,
        body: streamFromStrings([
          'data: {"choices":[{"delta":{"content":"匹配"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"度 90/100"}}]}\n\ndata: [DONE]\n\n',
        ]),
      };
    },
  });
  assert.equal(requests[0].url, JOB_FIT_ENDPOINT);
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[1].url, "https://api.deepseek.com/chat/completions");
  assert.equal(requests[1].options.headers.Authorization, "Bearer secret");
  assert.deepEqual(chunksSeen, ["岗位类型：产品\n简历路由：resume.html\nJD 字符数：7\n\n", "匹配", "度 90/100"]);
  assert.equal(result.output, "岗位类型：产品\n简历路由：resume.html\nJD 字符数：7\n\n匹配度 90/100");
});

test("job fit reports local service failures", async () => {
  await assert.rejects(
    () => streamJobFit({
      settings: { provider: "deepseek", apiKey: "secret" },
      pageContext: { url: "https://jobs.example/detail", html: "JD" },
      form: {},
      fetchImpl: async () => ({ ok: false, status: 500, text: async () => JSON.stringify({ ok: false, error: "resume missing" }) }),
    }),
    /resume missing/,
  );
});
