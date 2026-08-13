const CONTROL_SELECTOR = "input, select, textarea";
const BLOCKED_TYPES = new Set(["file", "submit", "button", "reset", "image", "hidden"]);
const OPTION_SELECTOR = '[role="option"], .el-select-dropdown__item, .ant-select-item-option, .ivu-select-item';
const CAPTCHA_PATTERN = /captcha|验证码|校验码|人机验证/i;

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeFieldToken(value) {
  return text(value).toLocaleLowerCase().replace(/[\s_\-:：/\\()[\]（）【】]+/g, "");
}

function labelText(control) {
  const direct = Array.from(control.labels || []).map((label) => text(label.textContent)).find(Boolean);
  if (direct) return direct;
  const id = text(control.id);
  if (id && control.ownerDocument?.querySelector) {
    const escaped = globalThis.CSS?.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");
    const label = control.ownerDocument.querySelector(`label[for="${escaped}"]`);
    if (label) return text(label.textContent);
  }
  return text(control.closest?.("label")?.textContent);
}

function fieldType(control) {
  const tag = String(control.tagName || "").toLowerCase();
  if (tag === "select" || tag === "textarea") return tag;
  return text(control.type).toLowerCase() || "text";
}

function customControlInfo(control) {
  const host = control.closest?.('[role="combobox"], .el-select, .el-date-editor, .el-radio-group, .el-checkbox-group, .ant-select, .ant-picker, .ivu-select, .ivu-date-picker');
  const className = text(host?.className || control.className);
  const role = text(control.getAttribute?.("role") || host?.getAttribute?.("role")).toLowerCase();
  if (role === "combobox" || /(?:el-select|ant-select|ivu-select)/i.test(className)) return { kind: "custom-select", host: host || control };
  if (/(?:date-editor|ant-picker|date-picker)/i.test(className)) return { kind: "custom-date", host: host || control };
  if (/radio-group/i.test(className)) return { kind: "custom-radio", host: host || control };
  if (/checkbox-group/i.test(className)) return { kind: "custom-checkbox", host: host || control };
  return { kind: "", host: null };
}

function isBlocked(control, descriptor = {}) {
  const type = descriptor.type || fieldType(control);
  const clue = [descriptor.key, descriptor.label, control.name, control.id, control.getAttribute?.("aria-label")].join(" ");
  const customKind = descriptor.customKind || customControlInfo(control).kind;
  return BLOCKED_TYPES.has(type) || CAPTCHA_PATTERN.test(clue) || control.disabled || (control.readOnly && !customKind);
}

function keyCandidates(control, label) {
  const values = [
    ["name", control.name],
    ["id", control.id],
    ["label", label],
    ["aria", control.getAttribute?.("aria-label")],
    ["placeholder", control.getAttribute?.("placeholder")],
  ];
  return values.map(([kind, value]) => [kind, text(value)]).filter(([, value]) => value);
}

export function describeResumeField(control, index = 0) {
  const label = labelText(control);
  const candidates = keyCandidates(control, label);
  const type = fieldType(control);
  const customKind = customControlInfo(control).kind;
  const fallback = `field-${index + 1}`;
  const key = candidates.length ? `${candidates[0][0]}:${candidates[0][1]}` : fallback;
  const options = type === "select"
    ? Array.from(control.options || []).map((option) => ({ value: text(option.value), label: text(option.textContent) }))
    : type === "radio" || type === "checkbox"
      ? [{ value: text(control.value), label: label || text(control.value) }]
      : [];
  return {
    key,
    aliases: candidates.map(([kind, value]) => `${kind}:${value}`),
    label: label || text(control.getAttribute?.("aria-label")) || text(control.getAttribute?.("placeholder")),
    type,
    customKind,
    required: Boolean(control.required),
    options,
    blocked: isBlocked(control, { key, label, type, customKind }),
  };
}

export function extractResumeFields(documentLike = document) {
  const controls = Array.from(documentLike.querySelectorAll(CONTROL_SELECTOR));
  const counts = new Map();
  return controls.map((control, index) => {
    const descriptor = describeResumeField(control, index);
    const count = counts.get(descriptor.key) || 0;
    counts.set(descriptor.key, count + 1);
    if (count) descriptor.key = `${descriptor.key}#${count + 1}`;
    return { control, descriptor };
  }).filter(({ descriptor }) => !descriptor.blocked);
}

function tokens(field) {
  return [field.key, field.label, ...(field.aliases || [])].map(normalizeFieldToken).filter(Boolean);
}

export function buildResumeFillPlan(fields, profile, aiMapping = {}) {
  const entries = Object.entries(profile || {}).filter(([, value]) => value !== undefined && value !== null && value !== "");
  const normalizedProfile = new Map(entries.map(([key, value]) => [normalizeFieldToken(key), { key, value }]));
  return fields.flatMap((field) => {
    const mappedProfileKey = aiMapping[field.key];
    const explicit = mappedProfileKey && Object.hasOwn(profile || {}, mappedProfileKey)
      ? { key: mappedProfileKey, value: profile[mappedProfileKey] }
      : null;
    const matched = explicit || tokens(field).map((token) => normalizedProfile.get(token)).find(Boolean);
    return matched ? [{ fieldKey: field.key, profileKey: matched.key, value: matched.value }] : [];
  });
}

export function createResumeAiMappingRequest(fields, profile) {
  return {
    task: "map_resume_profile_to_page_fields",
    rules: ["Only map supplied profile keys to supplied field keys", "Do not invent values", "Return a JSON object keyed by field key"],
    fields: fields.map(({ key, label, type, required, options }) => ({ key, label, type, required, options })),
    profileKeys: Object.keys(profile || {}),
    outputExample: { "name:email": "contact.email" },
  };
}

export function parseResumeAiMapping(value, fields, profile) {
  const parsed = typeof value === "string" ? JSON.parse(value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) : value;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new TypeError("AI 字段映射必须是 JSON 对象。");
  const allowedFields = new Set(fields.map((field) => field.key));
  const allowedProfile = new Set(Object.keys(profile || {}));
  return Object.fromEntries(Object.entries(parsed).filter(([fieldKey, profileKey]) => allowedFields.has(fieldKey) && allowedProfile.has(profileKey)));
}

function dispatchFrameworkEvents(control) {
  const EventCtor = control.ownerDocument?.defaultView?.Event || globalThis.Event;
  if (!EventCtor) return;
  control.dispatchEvent(new EventCtor("input", { bubbles: true, composed: true }));
  control.dispatchEvent(new EventCtor("change", { bubbles: true, composed: true }));
  control.dispatchEvent(new EventCtor("blur", { bubbles: true, composed: true }));
}

function isVisible(element) {
  if (!element || element.hidden || element.getAttribute?.("aria-hidden") === "true") return false;
  const style = element.ownerDocument?.defaultView?.getComputedStyle?.(element);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

function clickCustomChoice(control, rawValue) {
  const { host } = customControlInfo(control);
  (host || control).click?.();
  const wanted = normalizeFieldToken(rawValue);
  const choices = Array.from(control.ownerDocument?.querySelectorAll?.(OPTION_SELECTOR) || []);
  const choice = choices.find((item) => isVisible(item) && normalizeFieldToken(item.textContent || item.getAttribute?.("aria-label")) === wanted);
  if (!choice) return false;
  choice.click?.();
  return true;
}

function setNativeValue(control, property, value) {
  let prototype = Object.getPrototypeOf(control);
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (descriptor?.set) {
      descriptor.set.call(control, value);
      return;
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  control[property] = value;
}

function applyValue(control, descriptor, rawValue) {
  if (isBlocked(control, descriptor)) return false;
  if (descriptor.customKind === "custom-select" && clickCustomChoice(control, rawValue)) {
    dispatchFrameworkEvents(control);
    return true;
  }
  let value = rawValue;
  if (descriptor.type === "checkbox") {
    const normalized = normalizeFieldToken(value);
    const wanted = Array.isArray(value)
      ? value.map(String).includes(String(control.value))
      : typeof value === "boolean" ? value : ["true", "1", "yes", "是", "选中"].includes(normalized);
    setNativeValue(control, "checked", wanted);
  } else if (descriptor.type === "radio") {
    if (String(control.value) !== String(value)) return false;
    setNativeValue(control, "checked", true);
  } else {
    if (descriptor.type === "select") {
      const matchingOption = (descriptor.options || []).find((option) => String(option.value) === String(value) || normalizeFieldToken(option.label) === normalizeFieldToken(value));
      if (!matchingOption) return false;
      value = matchingOption.value;
    }
    setNativeValue(control, "value", String(value));
  }
  dispatchFrameworkEvents(control);
  return true;
}

export function fillResumeFields({ documentLike = document, plan, userInitiated = false }) {
  if (!userInitiated) throw new Error("简历填充必须由用户点击触发。");
  const extracted = extractResumeFields(documentLike);
  const controlsByKey = new Map(extracted.map(({ control, descriptor }) => [descriptor.key, { control, descriptor }]));
  const result = { filled: [], skipped: [] };
  for (const item of plan || []) {
    const target = controlsByKey.get(item.fieldKey);
    if (!target || !applyValue(target.control, target.descriptor, item.value)) result.skipped.push(item.fieldKey);
    else result.filled.push(item.fieldKey);
  }
  return result;
}
