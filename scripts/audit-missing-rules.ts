import fs from 'fs';
import path from 'path';

// Import DARK_PATTERN_RULES
import { DARK_PATTERN_RULES } from '../lib/engines/darkpattern-rules';

// Read darkpattern-engine.ts to extract VISUAL_AI_RULES and all makeFinding ruleId references
const engineContent = fs.readFileSync(path.join(process.cwd(), 'lib/engines/darkpattern-engine.ts'), 'utf-8');

// Registered IDs in DARK_PATTERN_RULES
const registeredIds = new Set(DARK_PATTERN_RULES.map(r => r.id));

// Extract rule IDs defined in VISUAL_AI_RULES
const visualAiMatch = engineContent.match(/VISUAL_AI_RULES.*?=\s*\[([\s\S]*?)\];/);
if (visualAiMatch) {
  const visualRuleIds = [...visualAiMatch[1].matchAll(/id:\s*['"](.*?)['"]/g)].map(m => m[1]);
  visualRuleIds.forEach(id => registeredIds.add(id));
}

// Extract ALL makeFinding ruleId calls e.g. makeFinding("DP-XX-YY", ...)
const makeFindingMatches = [...engineContent.matchAll(/makeFinding\(\s*['"](.*?)['"]/g)].map(m => m[1]);
const uniqueUsedIds = new Set(makeFindingMatches);

// Extract rule IDs in RULE_HANDOFF_METADATA map
const metadataMatch = engineContent.match(/RULE_HANDOFF_METADATA.*?=\s*\{([\s\S]*?)\};/);
const metadataIds = new Set<string>();
if (metadataMatch) {
  const keys = [...metadataMatch[1].matchAll(/['"](DP-.*?)['"]\s*:/g)].map(m => m[1]);
  keys.forEach(k => metadataIds.add(k));
}

console.log(`Total Rules in Master Array (DARK_PATTERN_RULES + VISUAL_AI): ${registeredIds.size}`);
console.log(`Total Rule IDs invoked in Scanner (makeFinding): ${uniqueUsedIds.size}`);
console.log(`Total Rule IDs in Handoff Metadata: ${metadataIds.size}`);

const missingFromMasterArray: string[] = [];
uniqueUsedIds.forEach(id => {
  if (!registeredIds.has(id)) {
    missingFromMasterArray.push(id);
  }
});

metadataIds.forEach(id => {
  if (!registeredIds.has(id)) {
    if (!missingFromMasterArray.includes(id)) {
      missingFromMasterArray.push(id);
    }
  }
});

console.log('\n--- MISSING RULE IDS (Used in scanner/metadata but missing from master rules array) ---');
console.log(missingFromMasterArray);
