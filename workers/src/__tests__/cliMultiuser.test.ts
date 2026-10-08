import { execFileSync } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';

// tests/cliMultiuser.test.sh runs bin/timdo against a Python mock of the v2 API
// (assignee filters, --assign/--claim/--unassign, org list/members/invite).
// cliWorkspace.test.ts covers the rest of the multi-user behaviour.
describe('CLI Multi-User Integration Tests', () => {
  it('passes all CLI multiuser test scenarios', () => {
    const scriptPath = path.resolve(__dirname, '../../../tests/cliMultiuser.test.sh');
    const result = execFileSync('bash', [scriptPath], {
      encoding: 'utf-8',
      env: { ...process.env, TIMDO_CONFIG: '/dev/null' },
    });
    expect(result).toContain('ALL CLI MULTI-USER TESTS PASSED!');
  }, 60_000);
});
