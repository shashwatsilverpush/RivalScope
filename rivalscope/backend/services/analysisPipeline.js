const { search } = require('./searchOrchestrator');
const { classify, classifyAllRoles } = require('./productClassifier');
const { FIELD_TEMPLATES, COMPANY_STRUCTURE_FIELDS } = require('./fieldTemplates');
const { analyzeWithStream, parseWithRetry, classifyWithFlash } = require('./llm');
const { compare } = require('./diffHighlighter');
const { getCompanyData } = require('./crunchbase');
const { getDb } = require('../db/database');

const SYSTEM_PROMPT = `You are a world-class AdTech industry analyst specializing in programmatic advertising, CTV/video ad tech, ad servers, DSPs, SSPs, DMPs, identity solutions, brand safety, consent management, and header bidding. You have deep knowledge of all major and emerging players in the AdTech ecosystem.

You will be given:
1. A list of products/companies with their web research context
2. A comparison scope (what to analyze)
3. A set of default comparison fields for the detected category
4. Optionally, a reference format from a previous analysis

Your job: produce a precise, data-driven, AdTech-specific competitor analysis.

CRITICAL RULES:
- Return ONLY a valid JSON object. No markdown. No backticks. No explanation. No preamble.
- Use real, specific data. If pricing is known, list exact tiers. If unknown, state "Not publicly disclosed".
- NEVER hallucinate or assume features. A product only has a capability if it is explicitly stated in the search context provided. If you cannot find evidence of a feature in the search context, write exactly "Unconfirmed" — never invent a value.
- NEVER leave a cell value empty or null. Every cell must contain a value. If unknown, write "Unconfirmed".
- Use the column names EXACTLY as given in the COLUMN NAMES section. Do not substitute domain names or URLs.
- The "columns" array MUST contain EXACTLY ["Field", product1, product2, ...]. NEVER include field/row names, scope names, or comparison categories as column headers — only product names belong after "Field".
- Each row object key set MUST be exactly: {"Field": "...", product1: "...", product2: "..."}. NEVER use field names, row labels, or scope categories as object keys in rows — only "Field" and product names are valid keys.
- Use ONLY the rows listed in REQUIRED ROWS. Do not add any extra rows beyond what is listed.
- For each cell, be specific to the AdTech context.
- The JSON must have exactly these fields:
  {
    "category": "<detected adtech category>",
    "columns": ["Field", "<Product1>", "<Product2>"],
    "rows": [ {"Field": "...", "<Product1>": "...", "<Product2>": "..."} ],
    "summary": "<2-3 sentence executive summary with specific insights>",
    "data_confidence": "<high|medium|low>",
    "generated_at": "<ISO timestamp>"
  }
- EVERY row object MUST contain ALL product column keys. Example for 3 products:
  {"Field": "Pricing", "Magnite": "CPM-based", "PubMatic": "Not publicly disclosed", "The Trade Desk": "CPM-based"}
  A row with ONLY a "Field" key and no product values is INVALID and will be rejected.

CONCISENESS RULES (strictly follow to reduce generation time):
- Each cell value: maximum 15 words
- Use standard AdTech abbreviations (VAST, VPAID, RTB, CTV, PMP, etc.)
- Lists: comma-separated values only, no full sentences
- Unknown pricing: write exactly "Not publicly disclosed"
- Unconfirmed feature: write exactly "Unconfirmed"
- No explanatory preamble in cell values`;

async function resolveProductName(identifier, searchResults) {
  if (!searchResults || searchResults.length === 0) return identifier;
  const context = searchResults.slice(0, 3).map(r => `${r.title}: ${r.description}`).join('\n');
  try {
    const result = await classifyWithFlash(
      `Based on these search results, what is the official company or product name for "${identifier}"?\n\n${context}\n\nReturn ONLY the canonical brand or product name as it appears on their website (e.g. proper capitalization, no domain extensions, no taglines). No explanation.`
    );
    const name = result.trim().replace(/["""]/g, '').split('\n')[0].trim()
      .replace(/^\d+[\.\)]\s*/, '');  // strip leading "1. " or "1) " list prefixes
    const cleaned = name.replace(/\.(com|co|io|net|org|tv|ai|app|video|media|ly|us|uk|ad)$/i, '');
    const finalName = cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : name;
    return finalName.length > 0 && finalName.length < 80 ? finalName : identifier;
  } catch {
    return identifier;
  }
}

async function enrichProduct(identifier, forceRefresh = false) {
  const db = getDb();
  const TTL_DAYS = 7;
  const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const cached = db.prepare(
    'SELECT * FROM product_contexts WHERE identifier = ? AND last_enriched_at > ? AND resolved_name IS NOT NULL'
  ).get(identifier, cutoff);

  const hasDomainName = cached && /\.[a-z]{2,}$/i.test(cached.resolved_name);
  // Also re-enrich if cached key_facts has fewer than 2 search results (stale from a failed search)
  const cachedSearchCount = cached
    ? (JSON.parse(cached.key_facts || '{}').search_results || []).length
    : 0;
  const hasPoorCache = cached && cachedSearchCount < 2;
  if (cached && !forceRefresh && !hasDomainName && !hasPoorCache) return cached;

  // Use the base name (without TLD) as the primary search term so unusual TLDs like
  // .vide don't produce irrelevant results. Keep the full identifier as a secondary term.
  const baseName = identifier.includes('.')
    ? identifier.replace(/\.[^.]+$/, '')
    : identifier;
  const searchQuery = baseName !== identifier
    ? `${baseName} adtech pricing features review`
    : `${identifier} adtech pricing features review`;
  const searchResults = await search(searchQuery);

  // If search returned no results and we have a usable existing cache, keep it
  if (searchResults.length === 0 && cached && !hasDomainName) {
    console.warn(`enrichProduct: search returned 0 results for "${identifier}", keeping existing cache`);
    return cached;
  }

  const [category, resolvedName] = await Promise.all([
    classify(identifier, searchResults),
    resolveProductName(identifier, searchResults),
  ]);
  const allRoles = await classifyAllRoles(identifier, searchResults);

  const searchContext = searchResults.map(r => `${r.title}: ${r.description}`).join('\n');
  const existing = db.prepare('SELECT * FROM product_contexts WHERE identifier = ?').get(identifier);

  const record = {
    identifier,
    resolved_name: resolvedName,
    adtech_category: category,
    known_roles: JSON.stringify(allRoles.length > 0 ? allRoles : [category]),
    description: searchContext.slice(0, 500),
    key_facts: JSON.stringify({ search_results: searchResults.slice(0, 3) }),
    last_enriched_at: new Date().toISOString(),
  };

  if (existing) {
    db.prepare(`UPDATE product_contexts SET resolved_name=?, adtech_category=?, known_roles=?, description=?, key_facts=?, last_enriched_at=? WHERE identifier=?`)
      .run(record.resolved_name, record.adtech_category, record.known_roles, record.description, record.key_facts, record.last_enriched_at, identifier);
  } else {
    db.prepare(`INSERT INTO product_contexts (identifier, resolved_name, adtech_category, known_roles, description, key_facts, last_enriched_at) VALUES (?,?,?,?,?,?,?)`)
      .run(identifier, record.resolved_name, record.adtech_category, record.known_roles, record.description, record.key_facts, record.last_enriched_at);
  }

  return { ...existing, ...record };
}

async function run({ title, products, scope, scopeWeights, referenceFormat, mode = 'fast', onProgress }) {
  const db = getDb();

  // Create analysis record
  const insertResult = db.prepare(
    `INSERT INTO analyses (title, scope, products_json, status) VALUES (?, ?, ?, 'running')`
  ).run(title || `Analysis ${new Date().toLocaleDateString()}`, scope || '', JSON.stringify(products));
  const analysisId = insertResult.lastInsertRowid;

  try {
    // Step 1: Sequential enrichment (parallel bursts trigger Cerebras 429 rate limits)
    onProgress?.({ step: 'enriching', progress: 10 });
    const enriched = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      onProgress?.({ step: 'enriching', product: p.identifier, progress: 10 + (i / products.length) * 20 });
      const ctx = await enrichProduct(p.identifier);
      enriched.push({ ...p, context: ctx });
    }

    // Step 2: Determine category
    const categories = enriched.map(p => p.context?.adtech_category).filter(Boolean);
    const categoryCount = {};
    for (const c of categories) categoryCount[c] = (categoryCount[c] || 0) + 1;
    let detectedCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'GENERAL';

    // If all products landed on different categories (no consensus), ask the LLM to classify the group together
    const VALID_CATEGORIES = [
      'DSP', 'SSP', 'AD_SERVER', 'SSAI_CTV', 'DMP_IDENTITY', 'AD_QUALITY', 'CMP', 'RETARGETING',
      'HEADER_BIDDING', 'DOOH', 'AGENCY', 'CONTEXTUAL_ADVERTISING', 'CREATIVE_TECH',
      'ATTRIBUTION_MEASUREMENT', 'NATIVE_ADVERTISING', 'BRAND_SAFETY', 'PROGRAMMATIC_AUDIO',
      'MOBILE_DSP', 'PUBLISHER_MONETIZATION', 'DATA_MARKETPLACE', 'RETAIL_MEDIA',
      'INFLUENCER_CREATOR', 'GENERAL',
    ];
    if (new Set(categories).size === categories.length && categories.length >= 2) {
      const groupContext = enriched.map(p =>
        `${p.context?.resolved_name || p.identifier}: individually classified as ${p.context?.adtech_category}`
      ).join('\n');
      try {
        const groupPrompt = `These products are being compared together:\n${groupContext}\n\nWhat single AdTech category BEST describes this entire competitive set? Choose the category that reflects their shared primary business.\n\nYou MUST return exactly one of these strings (copy it exactly, no changes):\n${VALID_CATEGORIES.join('\n')}\n\nReturn ONLY that one string, nothing else.`;
        const groupCategory = await classifyWithFlash(groupPrompt);
        const gc = groupCategory.trim().toUpperCase().replace(/[^A-Z_]/g, '');
        if (VALID_CATEGORIES.includes(gc)) detectedCategory = gc;
      } catch (e) {
        console.warn('Group classification failed, using majority vote:', e.message);
      }
    }

    const fields = FIELD_TEMPLATES[detectedCategory] || FIELD_TEMPLATES.GENERAL;

    db.prepare('UPDATE analyses SET detected_category = ? WHERE id = ?').run(detectedCategory, analysisId);

    // Determine whether the scope is custom (i.e. not covered by the standard category template).
    // If custom, we generate scope-specific field names from the LLM instead of using the template.
    const KNOWN_SCOPE_KEYWORDS = [
      'pricing', 'commercial', 'technical', 'integration', 'ctv', 'video', 'identity', 'privacy',
      'brand safety', 'measurement', 'audience', 'targeting', 'reporting', 'analytics', 'support',
      'onboarding', 'company structure', 'headcount', 'funding', 'full analysis', 'comprehensive',
    ];
    const scopeLower = (scope || '').toLowerCase();
    const isCustomScope = scope && !KNOWN_SCOPE_KEYWORDS.some(kw => scopeLower.includes(kw));

    let resolvedFields = fields;
    if (isCustomScope) {
      try {
        const fieldPrompt = `The user wants to compare AdTech products with this focus: "${scope}"

Generate exactly 10 concise field names (row headers) for a competitor comparison table on this topic.
Each field should be a short label (3-6 words max) that can be researched from public web sources.
Return ONLY a JSON array of strings. No explanation, no markdown.
Example format: ["Recent Product Announcements", "Key 2024 Launches", "Platform Updates", ...]`;
        const raw = await classifyWithFlash(fieldPrompt, 300);
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length >= 5) {
            resolvedFields = parsed.slice(0, 12);
          }
        }
      } catch (e) {
        console.warn('Scope-field generation failed, using template:', e.message);
      }
    }

    // Step 3: Gather search results per product — combine enrichment + scope-specific
    onProgress?.({ step: 'searching', progress: 40 });
    const productSearchResults = [];
    for (const p of enriched) {
      // Build a search query that reflects the actual scope, not just the category
      const productName = p.context?.resolved_name || p.identifier;
      const scopeLower = (scope || '').toLowerCase();
      const wantsCompanyData = scopeLower.includes('company structure') ||
        scopeLower.includes('headcount') || scopeLower.includes('founding');
      const searchSuffix = wantsCompanyData
        ? 'company founded employees headcount total funding raised headquarters crunchbase'
        : scope
          ? scopeLower.replace(/compare|comparison/g, '').trim().slice(0, 60)
          : detectedCategory.replace(/_/g, ' ').toLowerCase();
      const scopeResults = await search(`${productName} ${searchSuffix}`);
      // For custom/technical scopes run a second targeted search using the first resolved field
      // as an additional keyword (e.g. "PubMatic skadnetwork mmp integration mobile")
      const secondaryResults = isCustomScope && resolvedFields.length > 0
        ? await search(`${productName} ${resolvedFields[0].toLowerCase().slice(0, 40)} ${searchSuffix.slice(0, 30)}`)
        : [];
      const enrichmentResults = p.context?.key_facts
        ? (JSON.parse(p.context.key_facts).search_results || [])
        : [];
      const seen = new Set();
      const combined = [...scopeResults, ...secondaryResults, ...enrichmentResults].filter(r => {
        const key = r.url || r.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      productSearchResults.push({ ...p, searchResults: combined });
    }

    // Step 3b: Fetch Crunchbase company data if Company Structure scope is selected
    const wantsCompanyStructure = (scope || '').toLowerCase().includes('company structure') ||
      (scope || '').toLowerCase().includes('headcount') ||
      (scope || '').toLowerCase().includes('founding');
    const crunchbaseData = {};
    if (wantsCompanyStructure) {
      const cbResults = await Promise.allSettled(
        productSearchResults.map(p => getCompanyData(p.context?.resolved_name || p.identifier))
      );
      productSearchResults.forEach((p, i) => {
        const result = cbResults[i];
        if (result.status === 'fulfilled' && result.value) {
          crunchbaseData[p.context?.resolved_name || p.identifier] = result.value;
        }
      });
    }

    // Step 4: Build prompt
    const productContext = productSearchResults.map(p => {
      const role = p.role === 'main' ? '[MAIN PRODUCT]' : '[COMPETITOR]';
      const displayName = p.context?.resolved_name || p.identifier;
      const searchText = p.searchResults.slice(0, 6).map(r => `  - ${r.title}: ${r.description}`).join('\n');
      const cb = crunchbaseData[displayName];
      const cbText = cb ? `  [Crunchbase] Headcount: ${cb.headcount || 'N/A'} | Founded: ${cb.founded || 'N/A'} | Total Funding: ${cb.total_funding || 'N/A'} | Last Round: ${cb.last_round || 'N/A'} | HQ: ${cb.hq || 'N/A'}` : '';
      return `${role} ${displayName}\n${searchText}${cbText ? '\n' + cbText : ''}`;
    }).join('\n\n');

    const referenceInstruction = referenceFormat
      ? `\nREFERENCE FORMAT FROM UPLOADED FILE:\n${referenceFormat}\nUse this as guidance for row structure.`
      : '';

    const columnNames = enriched.map(p => p.context?.resolved_name || p.identifier);
    const allFields = wantsCompanyStructure
      ? [...resolvedFields, ...COMPANY_STRUCTURE_FIELDS]
      : resolvedFields;

    const userPrompt = `DETECTED CATEGORY: ${detectedCategory}

COLUMN NAMES (use these EXACT strings as JSON keys — do NOT use domain names, URLs, or any other form):
${columnNames.join(', ')}

PRODUCTS TO COMPARE:
${productContext}

COMPARISON SCOPE:
${scope || 'Full competitor analysis using default fields for this category'}

REQUIRED ROWS (use ONLY these as row fields — do not add, remove, or rename any):
${allFields.join('\n')}
${referenceInstruction}

Generate the competitor analysis JSON now.`;

    // Step 5: Stream analysis
    onProgress?.({ step: 'analyzing', progress: 60 });
    let buffer = '';
    const rawText = await analyzeWithStream(SYSTEM_PROMPT, userPrompt, mode, (chunk) => {
      buffer += chunk;
      onProgress?.({ step: 'streaming', chunk, buffer, progress: 60 + Math.min(25, buffer.length / 100) });
    });

    // Step 6: Parse result
    onProgress?.({ step: 'formatting', progress: 90 });
    const resultData = await parseWithRetry(rawText);
    resultData.generated_at = resultData.generated_at || new Date().toISOString();

    // Normalize summary — LLM occasionally returns an array instead of a string
    if (Array.isArray(resultData.summary)) {
      resultData.summary = resultData.summary.join(' ');
    }
    if (scopeWeights && scopeWeights.length > 0) {
      resultData.scope_weights = scopeWeights;
    }

    // Normalize: Cerebras may use the field name as the row key instead of "Field"
    // Expected: rows = [{"Field": "Pricing", "Product A": "...", "Product B": "..."}]
    // Actual:   rows = [{"Pricing": "...", "Product A": "...", "Product B": "..."}]
    const productIdentifiers = enriched.map(p => p.identifier.toLowerCase());
    const colsMatchProducts = (resultData.columns || []).slice(1).some(c =>
      productIdentifiers.some(pid => pid.includes(c.toLowerCase()) || c.toLowerCase().includes(pid))
    );

    if (resultData.rows?.length > 0 && !Object.prototype.hasOwnProperty.call(resultData.rows[0], 'Field')) {
      resultData.rows = resultData.rows.map(row => {
        const keys = Object.keys(row);
        // The field key is the one that doesn't match any product name
        const fieldKey = keys.find(k => !productIdentifiers.some(pid => pid.includes(k.toLowerCase()) || k.toLowerCase().includes(pid)));
        if (!fieldKey) return row;
        const newRow = { Field: fieldKey };
        for (const k of keys) {
          if (k !== fieldKey) newRow[k] = row[k];
        }
        return newRow;
      });
      // Rebuild columns as ["Field", ...productNames]
      const productCols = Object.keys(resultData.rows[0]).filter(k => k !== 'Field');
      resultData.columns = ['Field', ...productCols];
    }

    // Post-normalization sanity check: after normalization, columns[1+] should be product identifiers.
    // If they aren't, the LLM returned a fully transposed table (field names as columns, one row per product).
    // Detect this and transpose back.
    const normalizedColsMatchProducts = (resultData.columns || []).slice(1).some(c =>
      productIdentifiers.some(pid => pid.includes(c.toLowerCase()) || c.toLowerCase().includes(pid))
    );
    if (!normalizedColsMatchProducts && resultData.rows?.length > 0) {
      console.warn('Detected transposed table — attempting auto-transpose');
      // In transposed format: rows are products, columns are fields.
      // columns[0] may be "Field"/"Product" and the rest are field names.
      // rows[i].Field (or first column value) is the product name; other keys are field values.
      const fieldNames = (resultData.columns || []).slice(1); // the actual comparison fields
      const transposedRows = fieldNames.map(field => {
        const row = { Field: field };
        for (const srcRow of resultData.rows) {
          // Identify the product name from the row: it's the value of the first column or any key matching a product
          const productKey = Object.keys(srcRow).find(k =>
            k === 'Field' || productIdentifiers.some(pid => pid.includes(k.toLowerCase()) || k.toLowerCase().includes(pid))
          );
          const productName = productKey ? srcRow[productKey] : null;
          // Match the actual enriched product name
          const matchedProduct = enriched.find(p =>
            productName && (p.identifier.toLowerCase().includes(productName.toLowerCase()) || productName.toLowerCase().includes(p.identifier.toLowerCase()))
          );
          if (matchedProduct) {
            row[matchedProduct.identifier] = srcRow[field] || '';
          }
        }
        return row;
      });
      resultData.rows = transposedRows;
      resultData.columns = ['Field', ...enriched.map(p => p.identifier)];
    }

    // Step 6b: Enforce canonical resolved names on columns and row keys.
    // The LLM may ignore the COLUMN NAMES instruction and use domain names, partial names, or
    // any other form. This pass guarantees columns and row keys always use the resolved brand name.
    const colRemap = {};
    for (const col of (resultData.columns || []).slice(1)) {
      const colLower = col.toLowerCase();
      const matchedProduct = enriched.find(p => {
        const pid = p.identifier.toLowerCase();
        const pname = (p.context?.resolved_name || '').toLowerCase();
        return pid === colLower || pname === colLower ||
               pid.includes(colLower) || colLower.includes(pid) ||
               (pname && (pname.includes(colLower) || colLower.includes(pname)));
      });
      colRemap[col] = matchedProduct
        ? (matchedProduct.context?.resolved_name || matchedProduct.identifier)
        : col;
    }
    resultData.columns = ['Field', ...Object.keys(colRemap).map(k => colRemap[k])];
    resultData.rows = (resultData.rows || []).map(row => {
      const newRow = { Field: row.Field };
      for (const [key, value] of Object.entries(row)) {
        if (key === 'Field') continue;
        const keyLower = key.toLowerCase();
        const matchedProduct = enriched.find(p => {
          const pid = p.identifier.toLowerCase();
          const pname = (p.context?.resolved_name || '').toLowerCase();
          return pid === keyLower || pname === keyLower ||
                 pid.includes(keyLower) || keyLower.includes(pid) ||
                 (pname && (pname.includes(keyLower) || keyLower.includes(pname)));
        });
        const canonical = matchedProduct
          ? (matchedProduct.context?.resolved_name || matchedProduct.identifier)
          : key;
        newRow[canonical] = value;
      }
      return newRow;
    });

    // Step 6b post-check: detect hybrid columns (LLM included field names as column headers alongside
    // product names). If columns contains more entries than there are products + "Field", and some of
    // those extra columns match known field names, strip non-product columns and rebuild rows.
    const expectedProductCount = enriched.length;
    const currentDataCols = (resultData.columns || []).slice(1);
    const productOnlyCols = currentDataCols.filter(c => {
      const cl = c.toLowerCase();
      return enriched.some(p => {
        const pid = p.identifier.toLowerCase();
        const pname = (p.context?.resolved_name || '').toLowerCase();
        return cl === pid || cl === pname || cl.includes(pid) || pid.includes(cl) ||
               (pname && (cl.includes(pname) || pname.includes(cl)));
      });
    });
    if (productOnlyCols.length === expectedProductCount && currentDataCols.length > expectedProductCount) {
      console.warn('Step 6b: detected hybrid columns (field names mixed with product names) — stripping non-product columns');
      resultData.columns = ['Field', ...productOnlyCols];
      resultData.rows = (resultData.rows || []).map(row => {
        const newRow = { Field: row.Field };
        for (const col of productOnlyCols) newRow[col] = row[col] || 'Unconfirmed';
        return newRow;
      });
    }

    // Step 6b post-check: if rows have only "Field" key (LLM omitted product values), fill with Unconfirmed
    const productColNames = (resultData.columns || []).slice(1);
    if (productColNames.length > 0) {
      resultData.rows = (resultData.rows || []).map(row => {
        if (Object.keys(row).length <= 1 && row.Field) {
          const filled = { Field: row.Field };
          for (const col of productColNames) filled[col] = 'Unconfirmed';
          return filled;
        }
        return row;
      });
    }

    // Step 6b post-check: warn if rows have no product columns (salvage failed)
    const emptyRowCount = (resultData.rows || []).filter(r => Object.keys(r).length <= 1).length;
    if (emptyRowCount > 0) {
      console.warn(`Step 6b: ${emptyRowCount}/${resultData.rows.length} rows have no product data — likely LLM truncation`);
    }

    // Step 6d: Replace empty/null cell values with "Unconfirmed" (runs after all normalization)
    if (resultData.rows?.length > 0) {
      resultData.rows = resultData.rows.map(row => {
        const cleaned = { Field: row.Field };
        for (const [key, value] of Object.entries(row)) {
          if (key === 'Field') continue;
          cleaned[key] = (value === null || value === undefined || String(value).trim() === '') ? 'Unconfirmed' : value;
        }
        return cleaned;
      });
    }

    // Step 6c: Rename product keys in support_matrix to canonical names
    if (resultData.support_matrix?.length > 0) {
      resultData.support_matrix = resultData.support_matrix.map(entry => {
        const newEntry = { capability: entry.capability };
        for (const [key, value] of Object.entries(entry)) {
          if (key === 'capability') continue;
          const keyLower = key.toLowerCase();
          const matchedProduct = enriched.find(p => {
            const pid = p.identifier.toLowerCase();
            const pname = (p.context?.resolved_name || '').toLowerCase();
            return pid === keyLower || pname === keyLower ||
                   pid.includes(keyLower) || keyLower.includes(pid) ||
                   (pname && (pname.includes(keyLower) || keyLower.includes(pname)));
          });
          const canonical = matchedProduct
            ? (matchedProduct.context?.resolved_name || matchedProduct.identifier)
            : key;
          newEntry[canonical] = value;
        }
        return newEntry;
      });
    }

    // Step 7: Generate CSV
    let resultCsv = '';
    try {
      const { Parser } = require('json2csv');
      const parser = new Parser({ fields: resultData.columns || [] });
      resultCsv = parser.parse(resultData.rows || []);
    } catch (e) {
      console.error('CSV generation error:', e.message);
    }

    // Step 8: Save
    db.prepare(
      `UPDATE analyses SET result_json=?, result_csv=?, status='done', detected_category=?, completed_at=? WHERE id=?`
    ).run(JSON.stringify(resultData), resultCsv, resultData.category || detectedCategory, new Date().toISOString(), analysisId);

    onProgress?.({ step: 'done', analysisId, progress: 100 });

    return db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
  } catch (err) {
    db.prepare("UPDATE analyses SET status='error', error_message=? WHERE id=?").run(err.message, analysisId);
    onProgress?.({ step: 'error', error: err.message, analysisId });
    throw err;
  }
}

module.exports = { run, enrichProduct };
