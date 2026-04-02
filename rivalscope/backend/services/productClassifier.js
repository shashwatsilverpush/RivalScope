const { classifyWithFlash } = require('./llm');
const { getDb } = require('../db/database');

const VALID_CATEGORIES = [
  'DSP', 'SSP', 'AD_SERVER', 'SSAI_CTV', 'DMP_IDENTITY',
  'AD_QUALITY', 'CMP', 'RETARGETING', 'HEADER_BIDDING',
  'DOOH', 'AGENCY',
  'CONTEXTUAL_ADVERTISING', 'CREATIVE_TECH', 'ATTRIBUTION_MEASUREMENT',
  'NATIVE_ADVERTISING', 'BRAND_SAFETY', 'PROGRAMMATIC_AUDIO',
  'MOBILE_DSP', 'PUBLISHER_MONETIZATION', 'DATA_MARKETPLACE',
  'RETAIL_MEDIA', 'INFLUENCER_CREATOR',
  'GENERAL'
];

async function classify(identifier, searchResults) {
  const db = getDb();
  const cached = db.prepare('SELECT adtech_category FROM product_contexts WHERE identifier = ? AND adtech_category IS NOT NULL').get(identifier);
  if (cached?.adtech_category) return cached.adtech_category;

  const searchContext = searchResults.slice(0, 3).map(r => `${r.title}: ${r.description}`).join('\n');

  const prompt = `You are an AdTech industry expert. Based on the search context below, classify this product into exactly ONE category by matching what the product DOES to the category definitions.

CATEGORIES — pick the PRIMARY business function, ignore secondary capabilities:
- DSP: Buys programmatic ad inventory on behalf of advertisers across exchanges and SSPs. Core: bidding engine, audience targeting, real-time auctions.
- SSP: Monetizes publisher ad inventory by connecting it to demand sources. Core: yield management, auction logic, publisher controls.
- AD_SERVER: Delivers, tracks, and reports on ads. Core: creative trafficking, impression counting, frequency capping, guaranteed delivery.
- SSAI_CTV: Stitches ads into streaming video at the server level to prevent ad blocking. Core: manifest manipulation, ad pod management for VOD/live.
- DMP_IDENTITY: Builds and resolves user identity graphs; onboards first-party data; activates audience segments. Core: identity matching, CRM onboarding, segment taxonomy.
- AD_QUALITY: Detects invalid traffic (IVT/fraud) and measures viewability. Core: bot detection, MRC-accredited measurement, pre/post-bid blocking.
- CMP: Collects and manages user consent for privacy regulations (GDPR, CCPA). Core: consent banner, TCF compliance, consent signal propagation.
- RETARGETING: Re-engages users who previously visited a website or app using cookies, device IDs, or email lists. Core: pixel-based audience capture, cross-site user tracking.
- HEADER_BIDDING: Runs simultaneous auctions across multiple demand sources before the ad server. Core: Prebid.js wrapper, server-side bidding, yield optimization.
- DOOH: Serves ads on digital screens in physical locations (billboards, transit, retail). Core: screen network, venue-based targeting, programmatic OOH buying.
- AGENCY: Provides media planning, buying, and campaign management as a service. Core: managed service, strategy, media spend execution on behalf of clients.
- CONTEXTUAL_ADVERTISING: Analyzes the content of webpages, images, or videos in real-time to serve relevant ads WITHOUT tracking individual users. Core: NLP/computer vision content understanding, semantic targeting, cookieless by design. Key signal: targets the content/context, not the person — works without any user ID.
- CREATIVE_TECH: Builds or dynamically optimizes ad creatives. Core: DCO (dynamic creative optimization), template-based personalization, creative studio, A/B testing of ad variants.
- ATTRIBUTION_MEASUREMENT: Measures which marketing touchpoints drove conversions or revenue. Core: multi-touch attribution, marketing mix modeling (MMM), incrementality testing, conversion path analysis.
- NATIVE_ADVERTISING: Distributes sponsored content that matches the look and feel of the surrounding editorial. Core: in-feed placements, content recommendation widgets, publisher native supply.
- BRAND_SAFETY: Classifies content to prevent ads from appearing next to unsafe or unsuitable material. Core: content taxonomy, GARM alignment, keyword/topic exclusions, suitability scoring.
- PROGRAMMATIC_AUDIO: Buys and sells audio ad inventory programmatically. Core: streaming/podcast/radio inventory, DAI for audio, audio-specific targeting.
- MOBILE_DSP: Buys mobile app inventory for user acquisition and in-app advertising. Core: app install campaigns, mobile bidding, MMP integration, SKAdNetwork support.
- PUBLISHER_MONETIZATION: Helps publishers maximize revenue from their ad inventory beyond basic SSP. Core: yield stack management, demand diversification, revenue analytics for publishers.
- DATA_MARKETPLACE: Facilitates buying, selling, or sharing of data segments and signals between parties. Core: data onboarding, clean room queries, match rates, second-party data exchange.
- RETAIL_MEDIA: Enables retailers to sell advertising against their shopper data and on-site inventory. Core: retailer-owned media network, purchase-based targeting, closed-loop attribution.
- INFLUENCER_CREATOR: Connects brands with content creators for sponsored content campaigns. Core: creator discovery, campaign briefing, performance tracking, influencer payments.
- GENERAL: Does not clearly fit any of the above based on available information.

Product: ${identifier}

Search context (use this to understand what the product does):
${searchContext}

Return ONLY the category string, nothing else. Example: CONTEXTUAL_ADVERTISING`;

  try {
    const response = await classifyWithFlash(prompt);
    const category = response.trim().toUpperCase().replace(/[^A-Z_]/g, '');
    return VALID_CATEGORIES.includes(category) ? category : 'GENERAL';
  } catch (e) {
    console.error('Classification error:', e.message);
    return 'GENERAL';
  }
}

async function classifyAllRoles(identifier, searchResults) {
  const db = getDb();
  const cached = db.prepare('SELECT known_roles FROM product_contexts WHERE identifier = ?').get(identifier);
  if (cached?.known_roles) return JSON.parse(cached.known_roles);

  const context = searchResults.slice(0, 3).map(r => `${r.title}: ${r.description}`).join('\n');
  const prompt = `Product: ${identifier}
Context:
${context}

Which AdTech categories does this product operate in? Pick ALL that apply (max 4).
Valid categories: ${VALID_CATEGORIES.join(', ')}
Return ONLY a JSON array, e.g. ["SSP","AD_EXCHANGE"]. No explanation.`;

  try {
    const raw = await classifyWithFlash(prompt, 60);
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    const roles = Array.isArray(parsed) ? parsed.filter(r => VALID_CATEGORIES.includes(r)) : [];
    return roles.length > 0 ? roles : [];
  } catch {
    return [];
  }
}

module.exports = { classify, classifyAllRoles };
