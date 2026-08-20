import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraft } from '../src/domain.js';

const values = {};
globalThis.chrome = { storage: { local: {
  async get(key) { return { [key]: values[key] }; },
  async set(patch) { Object.assign(values, structuredClone(patch)); },
} } };

const { listDrafts, loadPageCache, markDraftForRetry, saveDraft, savePageForm } = await import('../src/storage.js');

test('page form cache preserves the selected job status', async () => {
  await savePageForm('https://jobs.example/1#detail', { companyName: 'Example', jobStatus: '二面' });
  const cache = await loadPageCache('https://jobs.example/1');
  assert.equal(cache.form.jobStatus, '二面');
});

test('failed queue and retry preserve draft.job.status', async () => {
  const draft = createDraft({ companyName: 'Example', jobTitle: 'Engineer', jobStatus: 'HR面' });
  await saveDraft(draft);
  await markDraftForRetry(draft.id);
  const saved = (await listDrafts()).find(item => item.id === draft.id);
  assert.equal(saved.job.status, 'HR面');
  assert.equal(saved.attemptCount, 1);
});
