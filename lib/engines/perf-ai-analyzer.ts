// ============================================================
// KPMG TrustLens — AI Performance Report Generator (Claude)
// Enriches raw PerformanceResult with AI-driven insights,
// business impact analysis, and Jira/ADO ticket generation.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type {
  PerformanceResult, AIPerformanceReport, AIRecommendation, DevTicket,
} from '../types/performance';
import { CWV_THRESHOLDS } from '../types/performance';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Build a compact performance summary for the prompt ───────────
function buildPerformanceSummary(result: PerformanceResult, url: string): string {
  const v = result.averageVitals;
  const t = CWV_THRESHOLDS;

  const cwvLines = [
    `LCP: ${v.lcp !== null ? `${v.lcp}ms (${v.lcp <= t.lcp.good ? 'Good' : v.lcp <= t.lcp.poor ? 'Needs Improvement' : 'Poor'})` : 'N/A'}`,
    `CLS: ${v.cls !== null ? `${v.cls} (${v.cls <= t.cls.good ? 'Good' : v.cls <= t.cls.poor ? 'Needs Improvement' : 'Poor'})` : 'N/A'}`,
    `FCP: ${v.fcp !== null ? `${v.fcp}ms (${v.fcp <= t.fcp.good ? 'Good' : v.fcp <= t.fcp.poor ? 'Needs Improvement' : 'Poor'})` : 'N/A'}`,
    `TTFB: ${v.ttfb !== null ? `${v.ttfb}ms (${v.ttfb <= t.ttfb.good ? 'Good' : v.ttfb <= t.ttfb.poor ? 'Needs Improvement' : 'Poor'})` : 'N/A'}`,
    `TBT: ${v.tbt !== null ? `${v.tbt}ms (${v.tbt <= t.tbt.good ? 'Good' : v.tbt <= t.tbt.poor ? 'Needs Improvement' : 'Poor'})` : 'N/A'}`,
    `INP: ${v.inp !== null ? `${v.inp}ms` : 'N/A'}`,
  ].join(' | ');

  const topIssues = result.pages
    .flatMap(p => p.resourceIssues)
    .filter(i => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 8)
    .map(i => `- [${i.severity.toUpperCase()}] ${i.type}: ${i.description}`)
    .join('\n');

  const uxSummary = result.uxPerformance
    ? `UX Score: ${result.uxPerformance.score}/100 | Loading: ${result.uxPerformance.initialLoadExperience.score}/100 | Responsiveness: ${result.uxPerformance.responsiveness.score}/100 | Animation: ${result.uxPerformance.animationPerformance.score}/100\nUX Pain Points: ${result.uxPerformance.painPoints.map(p => p.description).join('; ') || 'none detected'}`
    : '';

  const archSummary = result.architecture
    ? `Framework: ${result.architecture.framework ?? 'unknown'} | CDN: ${result.architecture.cdn ?? 'none'} | HTTP: ${result.architecture.httpVersion ?? 'unknown'} | Hosting: ${result.architecture.hostingPlatform ?? 'unknown'}`
    : '';

  const thirdPartySummary = result.thirdPartyImpact && result.thirdPartyImpact.length > 0
    ? `Third-party scripts: ${result.thirdPartyImpact.length} total | ${result.thirdPartyImpact.filter(t => t.blocking).length} blocking | Slowest: ${result.thirdPartyImpact[0]?.label} (${result.thirdPartyImpact[0]?.loadTimeMs}ms)`
    : 'No significant third-party scripts detected';

  const seoSummary = result.seoReadiness
    ? `SEO: title=${result.seoReadiness.hasMetaTitle ? '✓' : '✗'}, description=${result.seoReadiness.hasMetaDescription ? '✓' : '✗'}, canonical=${result.seoReadiness.hasCanonical ? '✓' : '✗'}, structured-data=${result.seoReadiness.hasStructuredData ? '✓' : '✗'}, robots.txt=${result.seoReadiness.hasRobotsTxt ? '✓' : '✗'}, sitemap=${result.seoReadiness.hasSitemap ? '✓' : '✗'}`
    : '';

  const netSim = result.networkSimulation && result.networkSimulation.length > 0
    ? `Network simulation — ${result.networkSimulation.map(s => `${s.label}: score ${s.score ?? '?'}/100`).join(' | ')}`
    : '';

  return `
URL: ${url}
Overall Performance Score: ${result.overallScore}/100
Pages Analyzed: ${result.pages.length}
Total Resource Issues: ${result.totalResourceIssues}

CORE WEB VITALS (averages):
${cwvLines}

TOP CRITICAL/HIGH ISSUES:
${topIssues || 'None detected'}

UX PERFORMANCE:
${uxSummary || 'Not measured'}

ARCHITECTURE:
${archSummary || 'Not detected'}

THIRD-PARTY IMPACT:
${thirdPartySummary}

SEO READINESS:
${seoSummary || 'Not measured'}

${netSim}
`.trim();
}

// ── Main AI report generator ─────────────────────────────────────
export async function generateAIPerformanceReport(
  result: PerformanceResult,
  url: string,
): Promise<AIPerformanceReport> {
  const summary = buildPerformanceSummary(result, url);

  const prompt = `You are a senior web performance consultant at KPMG advising a Fortune 500 enterprise client on their website performance.

Here is the automated performance audit data:
${summary}

Generate a comprehensive AI performance report. Return ONLY valid JSON with this exact structure:
{
  "executiveSummary": "3-sentence non-technical summary for C-suite. Focus on business impact, not technical terms.",
  "developerSummary": "2-3 sentences for engineering team. Technical root causes and priority fixes.",
  "uxNarrative": "2-3 sentences for product managers. Focus on user experience pain points and their business consequences.",
  "businessImpactNarrative": "Paragraph explaining bounce rate risk, conversion impact, SEO impact, and customer satisfaction risk in business language.",
  "overallROI": "Estimated business value of fixing all critical issues (e.g., '0.5-1% conversion rate improvement, equivalent to $X revenue annually for a site with Y monthly visitors').",
  "recommendations": [
    {
      "priority": "P0|P1|P2|P3|P4",
      "title": "Short action-oriented title",
      "description": "What the issue is",
      "rootCause": "Technical root cause",
      "whyItMatters": "Why this affects users and business",
      "businessImpact": "Specific business consequence (bounce rate, conversion, SEO, satisfaction)",
      "recommendation": "Specific fix with technical detail",
      "estimatedEffort": "Quick (hours)|Medium (days)|Sprint (weeks)",
      "expectedImprovement": "Quantified improvement e.g. 'LCP improves from 4.2s to ~2.1s'",
      "sampleCode": "Optional: 1-3 line code example if applicable",
      "estimatedROI": "Business value of fixing this specific issue"
    }
  ],
  "devTickets": [
    {
      "title": "Jira/ADO ticket title (imperative verb + component + outcome)",
      "description": "User story or technical description",
      "acceptanceCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
      "labels": ["performance", "web-vitals", "category-label"],
      "storyPoints": 1-8,
      "priority": "Critical|High|Medium|Low"
    }
  ]
}

Rules:
- Generate 4-8 recommendations covering the most impactful issues
- Generate 3-6 dev tickets for the highest priority items
- Focus on business language in executiveSummary and businessImpactNarrative
- Be specific with numbers where possible (e.g., "reduces LCP from 3.8s to ~2s")
- estimatedROI should use realistic but conservative estimates
- Keep sampleCode short (1-3 lines max) or omit if not clearly helpful
- Ticket titles should follow format: "Fix [Component]: [Outcome]" or "Optimize [Feature] to achieve [Metric]"`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: 'You are a senior web performance consultant generating enterprise audit reports. Return only valid JSON, no markdown, no explanation.',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');

    const parsed = JSON.parse(jsonMatch[0]);

    const recommendations: AIRecommendation[] = (parsed.recommendations || []).map((r: any) => ({
      priority: r.priority || 'P2',
      title: r.title || '',
      description: r.description || '',
      rootCause: r.rootCause || '',
      whyItMatters: r.whyItMatters || '',
      businessImpact: r.businessImpact || '',
      recommendation: r.recommendation || '',
      estimatedEffort: r.estimatedEffort || 'Medium (days)',
      expectedImprovement: r.expectedImprovement || '',
      sampleCode: r.sampleCode || undefined,
      estimatedROI: r.estimatedROI || undefined,
    }));

    const devTickets: DevTicket[] = (parsed.devTickets || []).map((t: any) => ({
      title: t.title || '',
      description: t.description || '',
      acceptanceCriteria: t.acceptanceCriteria || [],
      labels: t.labels || ['performance'],
      storyPoints: typeof t.storyPoints === 'number' ? t.storyPoints : 3,
      priority: t.priority || 'Medium',
    }));

    return {
      executiveSummary: parsed.executiveSummary || '',
      developerSummary: parsed.developerSummary || '',
      uxNarrative: parsed.uxNarrative || '',
      businessImpactNarrative: parsed.businessImpactNarrative || '',
      overallROI: parsed.overallROI || '',
      recommendations,
      devTickets,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[PerfAIAnalyzer] Error generating AI report:', err);
    return generateFallbackReport(result);
  }
}

// ── Fallback report when AI is unavailable ───────────────────────
function generateFallbackReport(result: PerformanceResult): AIPerformanceReport {
  const score = result.overallScore;
  const grade = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 50 ? 'needs improvement' : 'poor';
  const allIssues = result.pages.flatMap(p => p.resourceIssues);
  const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
  const highCount = allIssues.filter(i => i.severity === 'high').length;

  return {
    executiveSummary: `The website achieved a performance score of ${score}/100, rated as "${grade}." ${criticalCount > 0 ? `There are ${criticalCount} critical performance issues requiring immediate attention.` : 'No critical performance blockers were detected.'} ${highCount > 0 ? `${highCount} high-severity issues are impacting user experience and should be addressed in the next sprint.` : ''}`,
    developerSummary: `Performance analysis identified ${allIssues.length} resource issues across ${result.pages.length} pages. Primary areas requiring attention: ${Object.entries(result.resourceIssuesByType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type, count]) => `${type} (${count})`).join(', ')}.`,
    uxNarrative: result.uxPerformance
      ? `UX performance scored ${result.uxPerformance.score}/100. ${result.uxPerformance.painPoints.slice(0, 2).map(p => p.description).join(' ')}`
      : 'UX performance analysis is available in the UX Performance tab.',
    businessImpactNarrative: `A performance score of ${score}/100 ${score < 50 ? 'indicates significant performance issues that are likely causing elevated bounce rates and reduced conversion rates' : score < 75 ? 'suggests moderate performance issues that may be impacting user satisfaction and SEO rankings' : 'indicates good performance that is supporting positive user experience and SEO visibility'}.`,
    overallROI: 'AI ROI analysis unavailable — please retry AI analysis.',
    recommendations: result.recommendations.map(r => ({
      priority: r.priority,
      title: r.title,
      description: r.detail,
      rootCause: 'See technical details in the Resources tab.',
      whyItMatters: r.impact === 'Critical' ? 'This is a critical blocker that will directly impact user retention and conversion rates.' : 'This issue affects user experience and should be prioritized in the next development cycle.',
      businessImpact: `${r.impact} impact on user experience and performance metrics.`,
      recommendation: r.detail,
      estimatedEffort: r.effort,
      expectedImprovement: 'Improvement estimate requires AI analysis.',
      estimatedROI: undefined,
    })),
    devTickets: result.recommendations.slice(0, 3).map(r => ({
      title: `Fix Performance: ${r.title}`,
      description: r.detail,
      acceptanceCriteria: ['Performance issue is resolved', `${r.issueType ? `No "${r.issueType}" issues detected in next audit` : 'Performance score improves by at least 5 points'}`],
      labels: ['performance', r.issueType ?? 'optimization'],
      storyPoints: r.effort === 'Quick (hours)' ? 1 : r.effort === 'Medium (days)' ? 3 : 5,
      priority: r.impact as DevTicket['priority'],
    })),
    generatedAt: new Date().toISOString(),
  };
}
