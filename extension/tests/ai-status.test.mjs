import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiResponse } from '../src/ai.js';

test('AI output cannot introduce or overwrite job status', () => {
  const result = parseAiResponse('{"companyName":"Example","jobTitle":"Engineer","jobStatus":"Offer"}');
  assert.equal(Object.hasOwn(result, 'jobStatus'), false);
});
