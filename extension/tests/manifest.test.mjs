import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const m = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

test("manifest is MV3 with action-driven drawer and module service worker", () => {
  assert.equal(m.manifest_version, 3);
  assert.equal(m.action.default_popup, undefined);
  assert.equal(m.action.default_title, "采集投递草稿");
  assert.deepEqual(m.background, { service_worker: "src/background.js", type: "module" });
  assert.ok(m.web_accessible_resources[0].resources.includes("popup.html"));
  assert.ok(m.web_accessible_resources[0].resources.includes("drawer.css"));
  assert.ok(m.web_accessible_resources[0].resources.includes("src/*.js"));
});

test("manifest uses click-scoped injection and only required service hosts", () => {
  assert.deepEqual([...m.permissions].sort(), ["activeTab", "scripting", "storage"]);
  assert.deepEqual(m.host_permissions, ["https://api.deepseek.com/*", "http://localhost:3000/*", "http://127.0.0.1:3000/*", "http://127.0.0.1:8765/*"]);
  assert.equal(m.content_scripts, undefined);
});
