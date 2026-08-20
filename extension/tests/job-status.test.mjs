import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraft, retryDraft } from '../src/domain.js';
import { DEFAULT_JOB_STATUS, JOB_STATUSES, normalizeJobStatus } from '../src/job-status.js';

test('job status adapter exposes the frozen ten-value contract', () => {
  assert.deepEqual([...JOB_STATUSES], ['待投递','已投递','测评','笔试','一面','二面','HR面','Offer','拒绝','放弃']);
  assert.equal(DEFAULT_JOB_STATUS, '待投递');
  assert.equal(Object.isFrozen(JOB_STATUSES), true);
});

test('company-job drafts preserve every supported job status', () => {
  for (const status of JOB_STATUSES) {
    const draft = createDraft({ companyName: 'Example Tech', jobTitle: 'Engineer', jobStatus: status });
    assert.equal(draft.job.status, status);
  }
});

test('missing and illegal status default safely and retry preserves it', () => {
  assert.equal(normalizeJobStatus(undefined), '待投递');
  assert.equal(normalizeJobStatus('unknown'), '待投递');
  const draft = createDraft({ companyName: 'Example Tech', jobTitle: 'Engineer', jobStatus: 'Offer' });
  assert.equal(retryDraft([draft], draft.id)[0].job.status, 'Offer');
});

test('company-only drafts never carry job status', () => {
  const draft = createDraft({ entryMode: 'company-only', companyName: 'Example Tech', jobStatus: 'Offer' });
  assert.equal(draft.job, null);
  assert.equal(JSON.stringify(draft).includes('Offer'), false);
});
