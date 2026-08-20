import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const extensionRoot = new URL("../", import.meta.url);
const damagedPatterns = [/\?input\b/i, /\?textarea\b/i, /\?\/title/i, /\?\/h1/i, /\ufffd/];

async function assertAssets(root, label) {
  const manifestText = await readFile(new URL("manifest.json", root), "utf8");
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, "求职投递台采集器", `${label} manifest name`);
  assert.equal(manifest.action.default_title, "采集投递草稿", `${label} action title`);
  assert.ok(!damagedPatterns.some((pattern) => pattern.test(manifestText)), `${label} manifest has no mojibake`);

  const html = await readFile(new URL("popup.html", root), "utf8");
  assert.ok(!damagedPatterns.some((pattern) => pattern.test(html)), `${label} popup has no damaged patterns`);
  for (const id of ["capture-form", "feedback", "queue", "ai-fill", "maintain-resume", "open-settings", "settings-dialog", "settings-form", "success-dialog", "close-success", "company-fields", "job-fields"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${label} has #${id}`);
  }
  for (const tag of ["title", "h1", "form", "fieldset", "label", "button", "section", "script", "dialog", "select"]) {
    assert.equal(
      (html.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length,
      (html.match(new RegExp(`</${tag}>`, "gi")) ?? []).length,
      `${label} closes ${tag}`,
    );
  }
  assert.equal((html.match(/<input\b/gi) ?? []).length, 11, `${label} has 11 inputs`);
  assert.equal((html.match(/<textarea\b/gi) ?? []).length, 1, `${label} has 1 textarea`);
  assert.equal((html.match(/name=["']entryMode["']/gi) ?? []).length, 2, `${label} has two entry modes`);
  assert.equal((html.match(/name=["']jobStatus["']/gi) ?? []).length, 1, `${label} has one job status selector`);
  for (const status of ["待投递", "已投递", "测评", "笔试", "一面", "二面", "HR面", "Offer", "拒绝", "放弃"]) {
    assert.match(html, new RegExp(`<option value=["']${status}["']`), `${label} offers ${status}`);
  }
  assert.match(html, /<script\s+type=["']module["']\s+src=["']src\/popup\.js["']><\/script>/i, `${label} loads popup module`);
  assert.match(html, /<meta\s+charset=["']utf-8["']/i, `${label} declares UTF-8`);
}

test("source extension text assets and popup markup are intact", async () => assertAssets(extensionRoot, "source"));
test("built extension text assets and popup markup are intact", async () => assertAssets(new URL("dist/", extensionRoot), "dist"));
