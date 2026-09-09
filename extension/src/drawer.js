/* global chrome */
(() => {
  const DRAWER_ID = "goodjob-application-drawer";
  const STYLE_ID = "goodjob-application-drawer-style";
  const MAX_HTML_LENGTH = 120000;
  const MAX_TEXT_LENGTH = 60000;

  function readableHtml() {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll(`#${DRAWER_ID},script,style,noscript,svg,iframe`).forEach((node) => node.remove());
    return clone.outerHTML.replace(/\s+/g, " ").slice(0, MAX_HTML_LENGTH);
  }

  function readableText() {
    const roots = [...document.querySelectorAll("main,[role='main'],article,.position-detail,.job-detail,.atsx-rich-text,body")];
    const text = roots.map((node) => node.innerText || node.textContent || "").join("\n");
    return text.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
  }

  function pageContext() {
    return {
      title: document.title || "",
      url: location.href,
      html: readableHtml(),
      text: readableText(),
    };
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${DRAWER_ID} {
        position: fixed;
        z-index: 2147483647;
        top: 0;
        right: 0;
        width: 25vw;
        height: 100vh;
        border: 0;
        overflow: hidden;
        background: #f5f7fb;
        box-shadow: -12px 0 36px rgba(23, 32, 51, .2);
        color-scheme: light;
        transform: translateX(100%);
        transition: transform .24s ease;
      }
      #${DRAWER_ID}[data-open="true"] { transform: translateX(0); }
      #${DRAWER_ID} > iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: #f5f7fb;
      }
      @media (max-width: 900px) { #${DRAWER_ID} { width: 100vw; } }
      @media (prefers-reduced-motion: reduce) { #${DRAWER_ID} { transition: none; } }
    `;
    document.documentElement.append(style);
  }

  function ensureDrawer() {
    let drawer = document.getElementById(DRAWER_ID);
    if (drawer) return drawer;
    installStyles();
    drawer = document.createElement("aside");
    drawer.id = DRAWER_ID;
    drawer.dataset.open = "false";
    drawer.setAttribute("aria-label", "采集投递草稿");
    const frame = document.createElement("iframe");
    frame.title = "采集投递草稿";
    frame.src = chrome.runtime.getURL("popup.html?mode=drawer");
    drawer.append(frame);
    document.documentElement.append(drawer);
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow || event.data?.source !== "goodjob-drawer") return;
      if (event.data?.type === "CLOSE_DRAWER") {
        drawer.dataset.open = "false";
      }
      if (event.data?.type === "REQUEST_PAGE_CONTEXT") {
        frame.contentWindow?.postMessage({
          source: "goodjob-drawer",
          type: "PAGE_CONTEXT",
          requestId: event.data.requestId,
          context: pageContext(),
        }, "*");
      }
    });
    return drawer;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "TOGGLE_APPLICATION_DRAWER") return false;
    const drawer = ensureDrawer();
    const opening = drawer.dataset.open !== "true";
    drawer.dataset.open = String(opening);
    if (opening) drawer.querySelector("iframe")?.contentWindow?.focus();
    sendResponse({ drawerHandled: true, open: opening });
    return false;
  });
})();
