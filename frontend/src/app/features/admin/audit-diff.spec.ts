import { auditDiff } from './audit.page';

describe('auditDiff', () => {
  it('lists only changed fields of {before, after} objects', () => {
    expect(auditDiff('{"before":{"name":"A","code":"X"},"after":{"name":"B","code":"X"}}').map((l) => l.text)).toEqual(['name:', '- "A"', '+ "B"']);
  });

  it('shows a scalar {before, after} pair (role change) and keeps the other keys', () => {
    expect(auditDiff('{"before":["Developer"],"after":"SecurityAnalyst","gained":[]}').map((l) => l.kind)).toEqual(['-', '+', ' ']);
  });

  it('shows {from, to} status changes', () => {
    expect(auditDiff('{"from":"Open","to":"Triaged","reason":null}').map((l) => l.text)).toEqual(['- "Open"', '+ "Triaged"', 'reason: null']);
  });

  it('falls back to indented JSON, and to raw text when not JSON', () => {
    expect(auditDiff('{"userName":"x"}')[0].text).toBe('{');
    expect(auditDiff('not json')).toEqual([{ kind: ' ', text: 'not json' }]);
  });
});
