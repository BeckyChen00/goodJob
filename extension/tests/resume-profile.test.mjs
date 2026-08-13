import assert from 'node:assert/strict';
import test from 'node:test';
import { createChromeResumeStore, normalizeResumeFields } from '../resume-ui/resume-profile.js';

test('resume fields are normalized without supplying sensitive defaults', () => {
  assert.deepEqual(normalizeResumeFields(null), []);
  const fields = normalizeResumeFields([{ id: 'a', key: '  姓名 ', value: '示例值' }, { key: '', value: '' }]);
  assert.deepEqual(fields, [{ id: 'a', key: '姓名', value: '示例值' }]);
});

test('resume store persists and restores editable key-value fields', async () => {
  const state = {};
  const area = { async get(key) { return { [key]: state[key] }; }, async set(value) { Object.assign(state, value); } };
  const store = createChromeResumeStore(area);
  await store.save([{ id: 'field-1', key: '教育经历', value: '示例内容' }]);
  assert.deepEqual(await store.load(), [{ id: 'field-1', key: '教育经历', value: '示例内容' }]);
});

test('resume store rejects unavailable browser storage', () => {
  assert.throws(() => createChromeResumeStore(null), /本地存储不可用/);
});
