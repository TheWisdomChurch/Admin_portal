import type { NewMemberSubmission } from '@/lib/types';

export type NewMemberExportField = {
  label: string;
  value: string;
};

export type NewMemberExportRecord = {
  displayName: string;
  fields: NewMemberExportField[];
};

type FieldDefinition = {
  label: string;
  directKeys?: Array<keyof NewMemberSubmission>;
  valueKeys?: string[];
};

// This allowlist is the privacy boundary for every member export. Raw response
// keys, record IDs, form IDs, upload metadata, and unknown backend fields never
// cross into the presentation model.
export const NEW_MEMBER_EXPORT_FIELDS: FieldDefinition[] = [
  { label: 'Registration Number', directKeys: ['registrationCode'], valueKeys: ['registration_code', 'registrationNumber'] },
  { label: 'Full Name', directKeys: ['name'], valueKeys: ['full_name', 'fullName', 'member_name', 'memberName'] },
  { label: 'First Name', valueKeys: ['first_name', 'firstName'] },
  { label: 'Last Name', valueKeys: ['last_name', 'lastName', 'surname'] },
  { label: 'Email Address', directKeys: ['email'], valueKeys: ['email', 'email_address', 'emailAddress'] },
  { label: 'Phone Number', directKeys: ['contactNumber'], valueKeys: ['phone', 'phone_number', 'phoneNumber', 'mobile', 'contact_number'] },
  { label: 'Date of Birth', valueKeys: ['date_of_birth', 'dateOfBirth', 'dob', 'birthday'] },
  { label: 'Gender', valueKeys: ['gender', 'sex'] },
  { label: 'Marital Status', valueKeys: ['marital_status', 'maritalStatus'] },
  { label: 'Home Address', directKeys: ['contactAddress'], valueKeys: ['address', 'home_address', 'homeAddress', 'contact_address'] },
  { label: 'City', valueKeys: ['city', 'town'] },
  { label: 'State', valueKeys: ['state', 'province'] },
  { label: 'Country', valueKeys: ['country'] },
  { label: 'Occupation', valueKeys: ['occupation', 'profession'] },
  { label: 'How They Heard About Us', valueKeys: ['how_did_you_hear', 'howDidYouHear', 'referral_source', 'referralSource'] },
  { label: 'Membership Interest', valueKeys: ['membership_interest', 'membershipInterest', 'next_step', 'nextStep'] },
  { label: 'Prayer Request', valueKeys: ['prayer_request', 'prayerRequest'] },
  { label: 'Source Form', directKeys: ['formTitle'] },
  { label: 'Date Submitted', directKeys: ['createdAt'] },
];

function readableValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(readableValue).filter(Boolean).join(', ');
  return '';
}

function findValue(item: NewMemberSubmission, definition: FieldDefinition): string {
  for (const key of definition.directKeys || []) {
    const value = readableValue(item[key]);
    if (value) return key === 'createdAt' ? formatExportDate(value) : value;
  }
  for (const key of definition.valueKeys || []) {
    const value = readableValue(item.values?.[key]);
    if (value) return value;
  }
  return '';
}

function formatExportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function toNewMemberExportRecord(item: NewMemberSubmission): NewMemberExportRecord {
  const mapped = NEW_MEMBER_EXPORT_FIELDS.map((definition) => ({ label: definition.label, value: findValue(item, definition) }));
  const fullName = mapped.find((field) => field.label === 'Full Name')?.value;
  const firstName = mapped.find((field) => field.label === 'First Name')?.value || '';
  const lastName = mapped.find((field) => field.label === 'Last Name')?.value || '';
  const displayName = fullName || `${firstName} ${lastName}`.trim() || 'Unnamed member';
  return { displayName, fields: mapped.filter((field) => field.value) };
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function buildNewMembersExcelXml(records: NewMemberExportRecord[]): string {
  const labels = NEW_MEMBER_EXPORT_FIELDS.map((field) => field.label);
  const rows = records.map((record) => {
    const values = new Map(record.fields.map((field) => [field.label, field.value]));
    return `<Row>${labels.map((label) => `<Cell><Data ss:Type="String">${xmlEscape(values.get(label) || '')}</Data></Cell>`).join('')}</Row>`;
  }).join('');

  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#FACC15" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style><Style ss:ID="Body"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style></Styles>
<Worksheet ss:Name="New Members"><Table>${labels.map((_, index) => `<Column ss:AutoFitWidth="1" ss:Width="${index === 1 ? 150 : 130}"/>`).join('')}<Row ss:StyleID="Header">${labels.map((label) => `<Cell><Data ss:Type="String">${xmlEscape(label)}</Data></Cell>`).join('')}</Row>${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet></Workbook>`;
}
