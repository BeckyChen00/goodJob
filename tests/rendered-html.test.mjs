import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the job application tracker shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>求职投递台<\/title>/);
  assert.match(html, /求职投递台/);
  assert.match(html, /新增企业/);
  assert.match(html, /企业分类/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|SkeletonPreview/);
});

test("product source retains the parent-child and local-data workflows", async () => {
  const [page, storage, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const ownerships = \["央企"/);
  assert.match(page, /className="nav-children"/);
  assert.match(page, /CompanyDialog/);
  assert.match(page, /JobDialog/);
  assert.match(page, /exportData/);
  assert.match(page, /importData/);
  assert.match(storage, /job-application-tracker/);
  assert.match(storage, /createObjectStore\("companies"/);
  assert.match(storage, /createObjectStore\("jobs"/);
  assert.match(storage, /companyId/);
  assert.match(layout, /title: "求职投递台"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
