import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  fetchRepositoryResume,
  loadRepositoryResume,
  repositoryResumeValues,
  REPOSITORY_RESUME_PATH,
} from "../src/resume-repository.js";

const templateUrl = new URL("../resume-data/resume-profile.json", import.meta.url);

test("versioned repository template is valid and contains no supplied personal values", async () => {
  const source = await readFile(templateUrl, "utf8");
  const document = loadRepositoryResume(source);
  assert.equal(document.version, 1);
  assert.ok(document.fields.length >= 20);
  assert.ok(document.fields.every(({ value }) => value === ""));
  assert.equal(Object.getPrototypeOf(repositoryResumeValues(source)), null);
});

test("manually edited values remain importable without coercion", async () => {
  const value = JSON.parse(await readFile(templateUrl, "utf8"));
  value.updatedAt = "2026-08-13T12:00:00.000Z";
  value.fields.find(({ key }) => key === "personal.name").value = "示例姓名";
  assert.equal(repositoryResumeValues(JSON.stringify(value))["personal.name"], "示例姓名");
});

test("repository loader rejects unknown fields, unsafe keys, duplicates, BOM and oversized text", async () => {
  const value = JSON.parse(await readFile(templateUrl, "utf8"));
  value.fields[0].extra = true;
  assert.throws(() => loadRepositoryResume(JSON.stringify(value)), /unknown field/);
  delete value.fields[0].extra;
  value.fields[0].key = "__proto__";
  assert.throws(() => loadRepositoryResume(JSON.stringify(value)), /stable dotted key|unsafe/);
  value.fields[0].key = value.fields[1].key;
  assert.throws(() => loadRepositoryResume(JSON.stringify(value)), /duplicate/);
  assert.throws(() => loadRepositoryResume(`\ufeff${JSON.stringify(value)}`), /byte-order mark/);
  assert.throws(() => loadRepositoryResume(" ".repeat(2_000_001)), /exceeds/);
});

test("fetch adapter requests canonical path without cache and validates response", async () => {
  const source = await readFile(templateUrl, "utf8");
  const calls = [];
  const document = await fetchRepositoryResume(async (...args) => {
    calls.push(args);
    return { ok: true, text: async () => source };
  });
  assert.equal(document.fields[0].key, "personal.name");
  assert.deepEqual(calls, [[REPOSITORY_RESUME_PATH, { cache: "no-store" }]]);
  await assert.rejects(() => fetchRepositoryResume(async () => ({ ok: false })), /unable to load/);
});
