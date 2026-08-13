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
  for (const id of ["capture-form", "feedback", "queue"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${label} has #${id}`);
  }
  for (const tag of ["title", "h1", "form", "fieldset", "label", "button", "section", "script"]) {
    assert.equal(
      (html.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length,
      (html.match(new RegExp(`</${tag}>`, "gi")) ?? []).length,
      `${label} closes ${tag}`,
    );
  }
  assert.equal((html.match(/<input\b/gi) ?? []).length, 7, `${label} has 7 inputs`);
  assert.equal((html.match(/<textarea\b/gi) ?? []).length, 1, `${label} has 1 textarea`);
  assert.match(html, /<script\s+type=["']module["']\s+src=["']src\/popup\.js["']><\/script>/i, `${label} loads popup module`);
  assert.match(html, /<meta\s+charset=["']utf-8["']/i, `${label} declares UTF-8`);
}

test("source extension text assets and popup markup are intact", async () => assertAssets(extensionRoot, "source"));
test("built extension text assets and popup markup are intact", async () => assertAssets(new URL("dist/", extensionRoot), "dist"));
