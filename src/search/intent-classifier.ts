// Pure intent classifier — rule-based, no DI, no @Injectable.
// Phase 7 port (quick-260508-dlw). Mirrors content-search-service's classifier.
//
// Rule chain (first match wins):
//   1. ≤2 words AND lowered query matches a category synonym → 'category'
//   2. ≥3 words AND first word starts with capital letter      → 'business'
//   3. lowered query matches a service synonym                 → 'service'
//   4. otherwise                                               → 'general'

export type Intent = 'category' | 'business' | 'service' | 'general';

export interface IntentInput {
  query: string;
  categorySynonyms: Set<string>;
  serviceSynonyms: Set<string>;
}

export function classifyIntent(input: IntentInput): Intent {
  const { query, categorySynonyms, serviceSynonyms } = input;
  const trimmed = query.trim();
  if (trimmed.length === 0) return 'general';

  const lowered = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/);

  // Rule 1: ≤2 words AND lowered query matches a category synonym.
  if (words.length <= 2 && categorySynonyms.has(lowered)) {
    return 'category';
  }

  // Rule 2: ≥3 words AND first word starts with capital letter
  // (signal: proper noun — likely a business name).
  const firstWord = words[0];
  if (
    words.length >= 3 &&
    firstWord.length > 0 &&
    firstWord[0] === firstWord[0].toUpperCase() &&
    firstWord[0] !== firstWord[0].toLowerCase()
  ) {
    return 'business';
  }

  // Rule 3: lowered query matches a service synonym.
  if (serviceSynonyms.has(lowered)) {
    return 'service';
  }

  return 'general';
}
