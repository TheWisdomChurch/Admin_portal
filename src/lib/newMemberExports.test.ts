import { describe, expect, it } from 'vitest';

import { buildNewMembersExcelXml, toNewMemberExportRecord } from './newMemberExports';
import type { NewMemberSubmission } from './types';

const submission: NewMemberSubmission = {
  id: 'internal-id', formId: 'backend-form-id', formTitle: 'Add New Member', name: 'Ada Lovelace', email: 'ada@example.com', contactNumber: '+2348000000000', createdAt: '2026-07-27T10:00:00.000Z',
  values: { date_of_birth: '10/12/1990', prayer_request: 'Wisdom and strength', internal_owner_id: 'secret', upload_metadata: { key: 'private' } },
};

describe('new member export presentation model', () => {
  it('maps supported values to readable labels without exposing backend keys', () => {
    const record = toNewMemberExportRecord(submission);
    expect(record.displayName).toBe('Ada Lovelace');
    expect(record.fields).toContainEqual({ label: 'Date of Birth', value: '10/12/1990' });
    expect(JSON.stringify(record)).not.toContain('internal_owner_id');
    expect(JSON.stringify(record)).not.toContain('internal-id');
    expect(JSON.stringify(record)).not.toContain('backend-form-id');
  });

  it('escapes spreadsheet values and only emits approved headings', () => {
    const xml = buildNewMembersExcelXml([toNewMemberExportRecord({ ...submission, name: '<Ada & Co>' })]);
    expect(xml).toContain('&lt;Ada &amp; Co&gt;');
    expect(xml).toContain('Full Name');
    expect(xml).not.toContain('internal_owner_id');
  });
});
