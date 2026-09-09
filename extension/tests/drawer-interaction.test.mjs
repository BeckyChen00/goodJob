import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("extension action toggles a click-injected page drawer", async () => {
  const [background, drawer] = await Promise.all([
    readFile(new URL("src/background.js", root), "utf8"),
    readFile(new URL("src/drawer.js", root), "utf8"),
  ]);
  assert.match(background, /chrome\.action\.onClicked\.addListener\(toggleDrawer\)/);
  assert.match(background, /src\/drawer\.js/);
  assert.match(background, /response\?\.drawerHandled/);
  assert.match(drawer, /width:\s*25vw/);
  assert.match(drawer, /height:\s*100vh/);
  assert.match(drawer, /transform:\s*translateX\(100%\)/);
  assert.match(drawer, /popup\.html\?mode=drawer/);
  assert.match(drawer, /prefers-reduced-motion:\s*reduce/);
  assert.match(drawer, /drawerHandled:\s*true/);
  assert.match(drawer, /REQUEST_PAGE_CONTEXT/);
  assert.match(drawer, /PAGE_CONTEXT/);
  assert.match(drawer, /readableText/);
});

test("drawer page exposes an in-panel close control", async () => {
  const [html, popup] = await Promise.all([
    readFile(new URL("popup.html", root), "utf8"),
    readFile(new URL("src/popup.js", root), "utf8"),
  ]);
  assert.match(html, /id="close-drawer"/);
  assert.match(popup, /CLOSE_DRAWER/);
  assert.match(popup, /mode.*drawer/);
  assert.match(popup, /requestPageContextFromDrawer/);
  assert.match(popup, /REQUEST_PAGE_CONTEXT/);
});
