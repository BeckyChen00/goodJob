import assert from "node:assert/strict";
import test from "node:test";
import {
  buildResumeFillPlan,
  createResumeAiMappingRequest,
  describeResumeField,
  fillResumeFields,
  parseResumeAiMapping,
} from "../src/resume-fields.js";

class FakeEvent { constructor(type, options) { this.type = type; Object.assign(this, options); } }
class Control {
  constructor(values = {}) {
    Object.assign(this, { tagName: "INPUT", type: "text", name: "", id: "", value: "", disabled: false, readOnly: false, required: false, labels: [], events: [] }, values);
    this.ownerDocument = { defaultView: { Event: FakeEvent }, querySelector: () => null };
  }
  getAttribute(name) { return this.attributes?.[name] || ""; }
  closest() { return null; }
  dispatchEvent(event) { this.events.push(event.type); return true; }
}
function doc(controls) { return { querySelectorAll: () => controls }; }

test("stable field keys prefer name, id, label, aria and placeholder", () => {
  assert.equal(describeResumeField(new Control({ name: "user.email", id: "email" })).key, "name:user.email");
  assert.equal(describeResumeField(new Control({ id: "mobile" })).key, "id:mobile");
  assert.equal(describeResumeField(new Control({ labels: [{ textContent: " 姓名 " }] })).key, "label:姓名");
  assert.equal(describeResumeField(new Control({ attributes: { "aria-label": "地址" } })).key, "aria:地址");
});

test("descriptors expose select options and block unsafe controls", () => {
  const select = new Control({ tagName: "SELECT", name: "degree", options: [{ value: "1", textContent: "本科" }] });
  assert.deepEqual(describeResumeField(select).options, [{ value: "1", label: "本科" }]);
  assert.equal(describeResumeField(new Control({ type: "file", name: "resume" })).blocked, true);
  assert.equal(describeResumeField(new Control({ name: "captchaCode" })).blocked, true);
  assert.equal(describeResumeField(new Control({ type: "submit", name: "submit" })).blocked, true);
});

test("rule mapping supports exact aliases and validated AI overrides", () => {
  const fields = [{ key: "name:email", aliases: ["label:邮箱"], label: "邮箱", type: "text", options: [] }];
  assert.deepEqual(buildResumeFillPlan(fields, { 邮箱: "me@example.com" }), [{ fieldKey: "name:email", profileKey: "邮箱", value: "me@example.com" }]);
  const request = createResumeAiMappingRequest(fields, { "contact.email": "me@example.com" });
  assert.equal(request.fields[0].key, "name:email");
  assert.deepEqual(parseResumeAiMapping('{"name:email":"contact.email","bad":"missing"}', fields, { "contact.email": "x" }), { "name:email": "contact.email" });
  assert.deepEqual(buildResumeFillPlan(fields, { "contact.email": "x" }, { "name:email": "contact.email" })[0].value, "x");
});

test("fill requires explicit user action and emits framework events", () => {
  const input = new Control({ name: "email" });
  const documentLike = doc([input]);
  assert.throws(() => fillResumeFields({ documentLike, plan: [] }), /用户点击/);
  const result = fillResumeFields({ documentLike, plan: [{ fieldKey: "name:email", value: "me@example.com" }], userInitiated: true });
  assert.equal(input.value, "me@example.com");
  assert.deepEqual(input.events, ["input", "change", "blur"]);
  assert.deepEqual(result.filled, ["name:email"]);
});

test("radio and checkbox fill only matching controls", () => {
  const male = new Control({ type: "radio", name: "gender", value: "male" });
  const female = new Control({ type: "radio", name: "gender", value: "female" });
  const consent = new Control({ type: "checkbox", name: "consent", value: "yes" });
  const result = fillResumeFields({ documentLike: doc([male, female, consent]), plan: [{ fieldKey: "name:gender", value: "female" }, { fieldKey: "name:gender#2", value: "female" }, { fieldKey: "name:consent", value: true }], userInitiated: true });
  assert.equal(male.checked, undefined);
  assert.equal(female.checked, true);
  assert.equal(consent.checked, true);
  assert.deepEqual(result.filled, ["name:gender#2", "name:consent"]);
});

test("select labels resolve to option values and false-like checkbox text stays unchecked", () => {
  const degree = new Control({ tagName: "SELECT", name: "degree", options: [{ value: "1", textContent: "本科" }] });
  const consent = new Control({ type: "checkbox", name: "consent", value: "yes" });
  const result = fillResumeFields({ documentLike: doc([degree, consent]), plan: [{ fieldKey: "name:degree", value: "本科" }, { fieldKey: "name:consent", value: "false" }], userInitiated: true });
  assert.equal(degree.value, "1");
  assert.equal(consent.checked, false);
  assert.deepEqual(result.filled, ["name:degree", "name:consent"]);
});

test("readonly Element-style combobox is extracted and fills by clicking visible option", () => {
  const option = new Control({ tagName: "LI", textContent: "中国", clicked: false });
  option.click = () => { option.clicked = true; };
  const host = new Control({ tagName: "DIV", className: "el-select", clicked: false });
  host.click = () => { host.clicked = true; };
  const nationality = new Control({ name: "nationality", readOnly: true, attributes: { role: "combobox" } });
  nationality.closest = () => host;
  const documentLike = doc([nationality]);
  documentLike.querySelectorAll = (selector) => selector.includes("input") ? [nationality] : [option];
  nationality.ownerDocument = documentLike;
  documentLike.defaultView = { Event: FakeEvent, getComputedStyle: () => ({ display: "block", visibility: "visible" }) };
  const descriptor = describeResumeField(nationality);
  assert.equal(descriptor.customKind, "custom-select");
  assert.equal(descriptor.blocked, false);
  const result = fillResumeFields({ documentLike, plan: [{ fieldKey: "name:nationality", value: "中国" }], userInitiated: true });
  assert.equal(host.clicked, true);
  assert.equal(option.clicked, true);
  assert.deepEqual(result.filled, ["name:nationality"]);
});
