// Normalize Meta leadgen field_data into canonical Lead fields.
// Meta returns [{name: 'full_name', values: ['...']}, ...] — names vary by form
// locale and custom questions, so we match on a known alias map first and keep
// everything else under `custom`.

const NAME_KEYS = new Set([
  'full_name',
  'name',
  'your_name',
  'first_name_and_last_name',
  'first_name',
]);
const EMAIL_KEYS = new Set(['email', 'email_address', 'your_email']);
const PHONE_KEYS = new Set([
  'phone_number',
  'phone',
  'mobile_number',
  'whatsapp_number',
  'contact_number',
  'your_phone_number',
]);
const COMPANY_KEYS = new Set(['company_name', 'company', 'organisation', 'organization']);

const firstValue = (entry) =>
  Array.isArray(entry?.values) && entry.values.length ? String(entry.values[0]).trim() : '';

export const mapLeadgenFields = (fieldData = []) => {
  const out = { name: '', email: '', phone: '', company: '', custom: {} };

  for (const entry of fieldData) {
    const key = String(entry?.name || '').toLowerCase().trim();
    const value = firstValue(entry);
    if (!value) continue;

    if (NAME_KEYS.has(key)) out.name = out.name || value;
    else if (EMAIL_KEYS.has(key)) out.email = out.email || value.toLowerCase();
    else if (PHONE_KEYS.has(key)) out.phone = out.phone || value;
    else if (COMPANY_KEYS.has(key)) out.company = out.company || value;
    else out.custom[key] = value;
  }

  return out;
};

// Parse Meta's tracking_parameters array into utm_* fields.
// Shape: [{name: 'utm_source', value: 'fb'}, ...]
export const extractUtmParams = (trackingParameters = []) => {
  const utm = {
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
  };
  if (!Array.isArray(trackingParameters)) return utm;

  for (const p of trackingParameters) {
    const key = String(p?.name || '').toLowerCase().trim();
    if (key in utm && p?.value) utm[key] = String(p.value);
  }
  return utm;
};

// Guess surface from ad platform context. Meta's lead payload doesn't always
// tell us directly — best-effort from known fields.
export const detectPlatform = (lead = {}) => {
  const platform = String(lead.platform || '').toLowerCase();
  if (platform === 'ig' || platform === 'instagram') return 'instagram';
  if (platform === 'fb' || platform === 'facebook') return 'facebook';
  if (lead.is_messenger) return 'messenger';
  return 'facebook';
};
