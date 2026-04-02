const { getDb } = require('../db/database');

function getApiKey() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM app_config WHERE key = 'CRUNCHBASE_API_KEY'").get();
    return row?.value || process.env.CRUNCHBASE_API_KEY || null;
  } catch {
    return process.env.CRUNCHBASE_API_KEY || null;
  }
}

async function getCompanyData(name) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    // Step 1: Autocomplete to find the permalink
    const autoUrl = `https://api.crunchbase.com/api/v4/autocompletes?query=${encodeURIComponent(name)}&collection_ids=organizations&user_key=${apiKey}`;
    const autoRes = await fetch(autoUrl);
    if (!autoRes.ok) return null;
    const autoData = await autoRes.json();
    const permalink = autoData?.entities?.[0]?.identifier?.permalink;
    if (!permalink) return null;

    // Step 2: Fetch entity details
    const fields = 'short_description,founded_on,num_employees_enum,total_funding_usd,last_funding_type,last_funding_on,location_identifiers';
    const entityUrl = `https://api.crunchbase.com/api/v4/entities/organizations/${permalink}?field_ids=${fields}&user_key=${apiKey}`;
    const entityRes = await fetch(entityUrl);
    if (!entityRes.ok) return null;
    const entity = await entityRes.json();
    const props = entity?.properties || {};

    const headcount = formatHeadcount(props.num_employees_enum);
    const founded = props.founded_on?.value ? props.founded_on.value.slice(0, 4) : null;
    const funding = props.total_funding_usd ? formatFunding(props.total_funding_usd) : null;
    const lastRound = props.last_funding_type || null;
    const hq = props.location_identifiers?.find(l => l.location_type === 'city')?.value || null;

    return { headcount, founded, total_funding: funding, last_round: lastRound, hq };
  } catch {
    return null;
  }
}

function formatHeadcount(enumVal) {
  const map = {
    c_00001_00010: '1–10',
    c_00010_00050: '10–50',
    c_00050_00100: '50–100',
    c_00100_00250: '100–250',
    c_00250_00500: '250–500',
    c_00500_01000: '500–1,000',
    c_01000_05000: '1,000–5,000',
    c_05000_10000: '5,000–10,000',
    c_10000_max: '10,000+',
  };
  return map[enumVal] || enumVal || null;
}

function formatFunding(usd) {
  if (!usd) return null;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${Math.round(usd / 1e6)}M`;
  return `$${Math.round(usd / 1e3)}K`;
}

module.exports = { getCompanyData };
