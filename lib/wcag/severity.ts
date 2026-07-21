export type Severity = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 0.5
};

export const LEVEL_MULTIPLIERS: Record<string, number> = {
  'A': 1.5,
  'AA': 1.0,
  'AAA': 0.5
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#3B82F6'
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

export function getSeverityFromAxeImpact(impact: string | undefined): Severity {
  switch (impact) {
    case 'critical': return 'critical';
    case 'serious': return 'high';
    case 'moderate': return 'medium';
    case 'minor': return 'low';
    default: return 'medium';
  }
}

export function getImpactDescription(criterion: string, severity: Severity): string {
  const impactMap: Record<string, string> = {
    '1.1.1': 'Screen reader users cannot understand non-text content',
    '1.2.2': 'Deaf or hard-of-hearing users cannot access audio content',
    '1.2.5': 'Blind users cannot access visual information in videos',
    '1.3.1': 'Assistive technology users may not understand content structure',
    '1.3.2': 'Screen reader users may receive content in wrong order',
    '1.3.3': 'Users with visual or cognitive disabilities may miss instructions',
    '1.4.1': 'Color-blind users may miss information conveyed only by color',
    '1.4.3': 'Users with low vision cannot read text with poor contrast',
    '1.4.5': 'Users who need to resize text or change fonts cannot modify images of text',
    '1.4.10': 'Users who zoom in must scroll in two directions',
    '1.4.11': 'Users with low vision cannot distinguish UI components',
    '2.1.1': 'Users who cannot use a mouse are blocked from functionality',
    '2.1.2': 'Keyboard users get trapped and cannot navigate away',
    '2.2.1': 'Users with disabilities may not complete tasks before timeout',
    '2.2.2': 'Users with cognitive disabilities or vestibular disorders are affected',
    '2.4.1': 'Keyboard users must tab through all navigation on every page',
    '2.4.2': 'Screen reader users and all users cannot identify page purpose',
    '2.4.3': 'Keyboard users experience confusing navigation order',
    '2.4.4': 'Screen reader users cannot determine link destinations',
    '2.4.5': 'Users cannot find content through alternative navigation methods',
    '2.4.7': 'Keyboard users cannot see which element has focus',
    '2.4.11': 'Keyboard users cannot see focused element behind overlays',
    '2.5.3': 'Voice control users cannot activate controls by speaking visible labels',
    '2.5.4': 'Users with motor disabilities who cannot perform motion gestures',
    '2.5.7': 'Users with motor disabilities who cannot perform drag operations',
    '2.5.8': 'Users with motor disabilities may have difficulty clicking small targets',
    '3.1.1': 'Screen readers may use wrong language pronunciation',
    '3.1.2': 'Screen readers may mispronounce content in different languages',
    '3.2.1': 'Users experience unexpected changes when navigating with keyboard',
    '3.2.2': 'Users experience unexpected changes when interacting with controls',
    '3.2.4': 'Users cannot rely on consistent patterns across pages',
    '3.2.6': 'Users cannot reliably find help across pages',
    '3.3.1': 'Users cannot identify what form errors need to be corrected',
    '3.3.2': 'Users cannot understand what input is expected',
    '3.3.3': 'Users cannot correct errors without guidance',
    '3.3.4': 'Users may accidentally submit irreversible legal/financial transactions',
    '3.3.7': 'Users with cognitive disabilities must re-enter previously provided information',
    '3.3.8': 'Users with cognitive disabilities cannot complete authentication',
    '4.1.2': 'Assistive technologies cannot determine the purpose of UI components',
    '4.1.3': 'Screen reader users miss important status updates',
  };

  return impactMap[criterion] || `Users with disabilities are affected (${severity} severity)`;
}
