import PptxGenJS from 'pptxgenjs';
import { AuditResult, AccessibilityIssue } from '../types/audit';
import type { DarkPatternFinding } from '../types/darkpattern';
import type { RecommendationItem } from '../types/performance';

// ── KPMG Brand Palette ────────────────────────────────────────
const K = {
  navy:        '00338D',
  blue:        '005EB8',
  lightBlue:   '0091DA',
  teal:        '00B2A9',
  white:       'FFFFFF',
  offWhite:    'F5F7FA',
  lightGrey:   'EEF2F7',
  midGrey:     '8BA3C7',
  darkGrey:    '4A5568',
  nearBlack:   '1A2638',
  bgDark:      '020D1F',
  bgCard:      '0D1F3E',
  critical:    'E8002D',
  criticalBg:  'FFF0F3',
  high:        'FF6B00',
  highBg:      'FFF3E8',
  medium:      'F0AB00',
  mediumBg:    'FFFBE8',
  pass:        '00BA8C',
  passBg:      'E8FAF9',
};

const TEAM_COLOR: Record<string, string> = {
  'Frontend Dev': K.lightBlue, 'Designer': 'A78BFA',
  'Content': K.teal, 'QA': K.pass, 'PDF Team': K.medium, 'Design System': K.high,
};

function sevColor(s: string) { return ({critical: K.critical, high: K.high, medium: K.medium, low: K.lightBlue} as Record<string,string>)[s] || K.midGrey; }
function sevBg(s: string)    { return ({critical: K.criticalBg, high: K.highBg, medium: K.mediumBg, low: 'E8F6FF'} as Record<string,string>)[s] || K.lightGrey; }
function compLabel(l: string){ return ({
  'non-compliant':'Non-Compliant','partially-compliant':'Partially Compliant',
  'aa-compliant':'WCAG AA Compliant','aaa-compliant':'WCAG AAA Compliant',
} as Record<string,string>)[l] || l; }

function deriveTeam(issue: AccessibilityIssue): string {
  const c = issue.wcagCriterion;
  if (['1.1.1','1.2.1','1.2.2','1.2.5'].includes(c)) return 'Content';
  if (['1.4.3','1.4.11','1.3.3'].includes(c)) return 'Designer';
  if (issue.source === 'pdf-analyzer' || issue.category === 'pdf') return 'PDF Team';
  if (['1.3.1','4.1.2','4.1.3'].includes(c)) return 'Design System';
  if (['3.3.1','3.3.2','3.3.3'].includes(c)) return 'Frontend Dev';
  if (issue.source === 'journey-test') return 'QA';
  return 'Frontend Dev';
}

function deriveEffort(issue: AccessibilityIssue): string {
  return ({critical:'1 Sprint', high:'Half-day', medium:'1 hour', low:'Quick Win'} as Record<string,string>)[issue.severity] || '1 hour';
}

type Slide = PptxGenJS.Slide;

// ── Slide scaffolding helpers ─────────────────────────────────

/** KPMG dark background — used for title/section slides */
function darkSlide(pptx: PptxGenJS): Slide {
  const s = pptx.addSlide();
  s.background = { color: K.bgDark };
  // Navy top bar
  s.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0, y:0, w:10, h:0.07, fill:{ color: K.navy } });
  // Teal bottom bar
  s.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0, y:7.43, w:10, h:0.07, fill:{ color: K.teal } });
  return s;
}

/** White content slide with KPMG header strip */
function lightSlide(pptx: PptxGenJS): Slide {
  const s = pptx.addSlide();
  s.background = { color: K.white };
  // Navy top bar (thicker)
  s.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0, y:0, w:10, h:0.09, fill:{ color: K.navy } });
  // Light blue bottom accent
  s.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0, y:7.43, w:10, h:0.04, fill:{ color: K.lightBlue } });
  return s;
}

function addLogo(s: Slide, dark = false) {
  s.addText('KPMG', {
    x:0.3, y:0.01, w:1.2, h:0.12,
    fontSize: 9, fontFace:'Calibri', bold:true,
    color: dark ? K.white : K.white,
    valign:'middle',
  });
}

function addPageNum(s: Slide, n: number) {
  s.addText(String(n), { x:9.2, y:7.3, w:0.5, h:0.25, fontSize:8, color: K.midGrey, align:'right', fontFace:'Calibri' });
}

function addSlideTitle(s: Slide, title: string, sub?: string) {
  s.addText(title, { x:0.4, y:0.22, w:9.2, h:0.55, fontSize:26, fontFace:'Calibri', bold:true, color: K.navy });
  s.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0.4, y:0.82, w:1.8, h:0.035, fill:{ color: K.lightBlue } });
  if (sub) s.addText(sub, { x:0.4, y:0.88, w:9.2, h:0.3, fontSize:10, fontFace:'Calibri', color: K.midGrey });
}

// ── Main Export ───────────────────────────────────────────────
export async function generatePptx(audit: AuditResult): Promise<Buffer> {
  const report      = audit.report!;
  const score       = audit.score;
  const issues      = audit.issues;
  const config      = audit.config;
  const testedLevel = report.testedLevel || 'AA';
  const standard    = config.standard || 'WCAG 2.2';
  const auditDate   = new Date(audit.startedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const projectName = config.url || 'PDF Document';

  const critical  = issues.filter(i => i.severity === 'critical');
  const high      = issues.filter(i => i.severity === 'high');
  const medium    = issues.filter(i => i.severity === 'medium');
  const quickWins = issues.filter(i => i.severity === 'low');

  // ── Pillar-aware title ──────────────────────────────────────
  const pillars = ((config as any).enabledPillars as string[] | undefined) || [];
  const reportTitle = pillars.length === 0 || (pillars.includes('accessibility') && pillars.length === 1)
    ? 'Accessibility Audit'
    : pillars.length === 1
      ? ({ darkpatterns: 'Dark Pattern Audit', performance: 'Performance Audit', privacy: 'Privacy Compliance Audit' } as Record<string,string>)[pillars[0]] || 'Digital Trust Audit'
      : pillars.length === 4 ? 'TrustLens 4-Pillar Audit' : 'TrustLens Multi-Pillar Audit';
  const isA11y = pillars.length === 0 || pillars.includes('accessibility');
  const isDP   = pillars.includes('darkpatterns');
  const isPerf = pillars.includes('performance');
  const isPriv = pillars.includes('privacy');
  const dpFindings: DarkPatternFinding[] = (audit as any).pillarResults?.darkpatterns?.findings || [];

  const pptx = new PptxGenJS();
  pptx.layout    = 'LAYOUT_16x9';
  pptx.author    = `KPMG ${reportTitle}`;
  pptx.company   = 'KPMG';
  pptx.title     = `KPMG ${reportTitle} — ${projectName}`;
  pptx.subject   = `${reportTitle} Final Delivery Report`;

  let n = 0;

  // ══════════════════════════════════════════════════
  // SLIDE 1 — TITLE
  // ══════════════════════════════════════════════════
  n++;
  const title = darkSlide(pptx);

  // Left accent bar
  title.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0, y:1.0, w:0.07, h:5.5, fill:{ color: K.lightBlue } });

  title.addText('KPMG', { x:0.4, y:1.2, w:9, h:0.8, fontSize:48, fontFace:'Calibri', bold:true, color: K.navy });
  title.addText(reportTitle, { x:0.4, y:1.9, w:9, h:0.7, fontSize:36, fontFace:'Calibri', bold:false, color: K.white });
  title.addText('Final Delivery Report', { x:0.4, y:2.55, w:9, h:0.55, fontSize:22, fontFace:'Calibri', color: K.teal });
  title.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0.4, y:3.25, w:2.8, h:0.035, fill:{ color: K.lightBlue } });
  title.addText(projectName, { x:0.4, y:3.4, w:8.5, h:0.4, fontSize:13, fontFace:'Calibri', color: K.midGrey, italic:true });
  title.addText([
    ...(isA11y ? [{ text: `${standard} Level ${testedLevel}   ·   `, options:{ bold:true, color: K.lightBlue, fontSize:11 } }] : []),
    { text: auditDate + '   ·   ', options:{ color: K.midGrey, fontSize:11 } },
    { text: `Score: `, options:{ bold:true, color: K.lightBlue, fontSize:11 } },
    { text: `${score.overall}/100`, options:{ bold:true, color: score.overall >= 75 ? K.teal : score.overall >= 50 ? K.medium : K.critical, fontSize:11 } },
    ...(pillars.length > 1 ? [{ text: `   ·   Pillars: ${pillars.join(', ')}`, options:{ color: K.midGrey, fontSize:10 } }] : []),
  ], { x:0.4, y:4.0, w:9, h:0.4, fontFace:'Calibri' });

  // Score circle
  title.addShape('ellipse' as unknown as PptxGenJS.ShapeType, { x:7.6, y:2.0, w:2.0, h:2.0, fill:{ color: K.bgCard }, line:{ color: K.lightBlue, width:3 } });
  title.addText(String(score.overall), { x:7.6, y:2.0, w:2.0, h:1.6, fontSize:44, fontFace:'Calibri', bold:true, color: score.overall >= 75 ? K.teal : score.overall >= 50 ? K.medium : K.critical, align:'center', valign:'middle' });
  title.addText('SCORE', { x:7.6, y:3.4, w:2.0, h:0.4, fontSize:9, fontFace:'Calibri', color: K.midGrey, align:'center' });
  title.addText('Confidential / KPMG Internal', { x:0, y:6.85, w:10, h:0.35, fontSize:8, fontFace:'Calibri', color: K.midGrey, align:'center', italic:true });
  addPageNum(title, n);

  // ══════════════════════════════════════════════════
  // SLIDE 2 — AGENDA
  // ══════════════════════════════════════════════════
  n++;
  const agenda = lightSlide(pptx);
  addLogo(agenda);
  addSlideTitle(agenda, 'Report Agenda');

  const agendaItemsAll = [
    { always: true,   label: 'Executive Summary', desc: 'Score, risk heat map, business impact, KPIs' },
    { always: isA11y, label: 'Issue Backlog',      desc: 'Developer-format issues with WCAG refs, team owner, effort' },
    { always: isA11y, label: 'Component Findings', desc: 'Issues grouped by UI component — fix once, resolve many' },
    { always: isA11y, label: 'Remediation Guidance', desc: 'Practical notes per team: Frontend, Designer, Content, QA, PDF' },
    { always: isA11y, label: 'Priority Matrix',    desc: 'Critical → Sprint 1, High → Sprint 2, Medium → Q2, Quick Wins → Today' },
    { always: isA11y, label: 'Acceptance Criteria', desc: '"Done When" checklist — use as QA regression test cases' },
    { always: isDP,   label: 'Dark Pattern Findings', desc: `${dpFindings.length} pattern(s) detected — CCPA taxonomy + DSA Article 25` },
  ].filter(i => i.always);
  const agendaItems = agendaItemsAll.map((item, i) => [String(i + 1).padStart(2, '0'), item.label, item.desc]);

  agendaItems.forEach(([num, heading, desc], i) => {
    const y = 1.2 + i * 0.9;
    agenda.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x:0.4, y, w:0.55, h:0.55, rectRadius:0.06, fill:{ color: K.navy } });
    agenda.addText(num, { x:0.4, y, w:0.55, h:0.55, fontSize:12, fontFace:'Calibri', bold:true, color: K.white, align:'center', valign:'middle' });
    agenda.addText(heading, { x:1.1, y: y+0.02, w:4, h:0.3, fontSize:13, fontFace:'Calibri', bold:true, color: K.nearBlack });
    agenda.addText(desc, { x:1.1, y: y+0.3, w:8.5, h:0.25, fontSize:9, fontFace:'Calibri', color: K.midGrey });
  });
  addPageNum(agenda, n);

  // ══════════════════════════════════════════════════
  // SLIDE 3 — EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════════
  n++;
  const exec = darkSlide(pptx);
  addLogo(exec);
  exec.addText('Executive Summary', { x:0.4, y:0.22, w:9, h:0.55, fontSize:26, fontFace:'Calibri', bold:true, color: K.white });
  exec.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0.4, y:0.82, w:1.8, h:0.035, fill:{ color: K.lightBlue } });

  // 4 KPI cards
  const sevs = [
    { label:'Critical', count: score.issueBySeverity.critical, color: K.critical },
    { label:'High',     count: score.issueBySeverity.high,     color: K.high },
    { label:'Medium',   count: score.issueBySeverity.medium,   color: K.medium },
    { label:'Quick Wins', count: quickWins.length,             color: K.teal },
  ];
  sevs.forEach(({ label, count, color }, i) => {
    const x = 0.4 + i * 2.3;
    exec.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x, y:1.1, w:2.1, h:1.4, rectRadius:0.1, fill:{ color: K.bgCard }, line:{ color, width:1 } });
    exec.addText(String(count), { x, y:1.15, w:2.1, h:0.85, fontSize:42, fontFace:'Calibri', bold:true, color, align:'center', valign:'middle' });
    exec.addText(label.toUpperCase(), { x, y:2.0, w:2.1, h:0.35, fontSize:9, fontFace:'Calibri', bold:true, color, align:'center' });
  });

  // Category scores strip
  const cats = [['Perceivable','perceivable'],['Operable','operable'],['Understandable','understandable'],['Robust','robust']];
  cats.forEach(([label, key], i) => {
    const v = score.categoryScores[key as keyof typeof score.categoryScores] || 0;
    const col = v >= 75 ? K.teal : v >= 50 ? K.medium : K.critical;
    const x = 0.4 + i * 2.3;
    exec.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x, y:2.8, w:2.1, h:1.1, rectRadius:0.08, fill:{ color: K.bgCard } });
    exec.addText(String(v), { x, y:2.85, w:2.1, h:0.55, fontSize:28, fontFace:'Calibri', bold:true, color:col, align:'center', valign:'middle' });
    exec.addText('/100', { x, y:3.28, w:2.1, h:0.22, fontSize:8, fontFace:'Calibri', color: K.midGrey, align:'center' });
    exec.addText(label, { x, y:3.5, w:2.1, h:0.3, fontSize:9, fontFace:'Calibri', color: K.midGrey, align:'center' });
  });

  // Summary text
  const summaryText = (report.executiveSummary || '').substring(0, 350);
  exec.addText(summaryText, { x:0.4, y:4.1, w:9.2, h:1.6, fontSize:9.5, fontFace:'Calibri', color: K.midGrey, lineSpacingMultiple:1.4, valign:'top' });

  // Compliance badge
  const compText = compLabel(score.complianceLevel);
  const compColor = score.complianceLevel.includes('non') ? K.critical : K.teal;
  exec.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x:0.4, y:5.85, w:3.2, h:0.42, rectRadius:0.08, fill:{ color: K.bgCard }, line:{ color:compColor, width:1.5 } });
  exec.addText(compText, { x:0.4, y:5.85, w:3.2, h:0.42, fontSize:11, fontFace:'Calibri', bold:true, color:compColor, align:'center', valign:'middle' });

  // Page coverage
  if (audit.crawlCoverage) {
    exec.addText(`Page Coverage: ${audit.crawlCoverage.coveragePercent}%  (${audit.crawlCoverage.pagesAudited} of ${audit.crawlCoverage.totalPagesFound} pages)`, {
      x:3.8, y:5.92, w:5.8, h:0.3, fontSize:9, fontFace:'Calibri', color: K.midGrey, align:'right',
    });
  }
  addPageNum(exec, n);

  // ══════════════════════════════════════════════════
  // SLIDES 4-N — ACCESSIBILITY-ONLY SLIDES
  // ══════════════════════════════════════════════════
  if (isA11y) {

  // ── Slide 4: Business Impact ──
  n++;
  const impact = lightSlide(pptx);
  addLogo(impact);
  addSlideTitle(impact, 'Business Impact', 'Why this matters to your users and your organisation');

  const impacts = [
    { icon:'SR', label:'Screen Reader Users', text:`${critical.length + high.length} issues directly block assistive technology users from completing tasks.` },
    { icon:'KB', label:'Keyboard-Only Users', text:'Focus management failures prevent users who rely on keyboard navigation.' },
    { icon:'LV', label:'Low Vision Users', text: score.categoryScores.perceivable < 70 ? 'Colour contrast and visual clarity issues detected across multiple pages.' : 'Perceivable category is above threshold — colour/contrast issues are low.' },
    { icon:'LG', label:'Legal Exposure', text:`${standard} Level ${testedLevel} non-compliance may violate ADA, EN 301 549, or Section 508 obligations.` },
    { icon:'IN', label:'Reach & Inclusivity', text:'~15% of the global population lives with a disability — these are real users today.' },
    { icon:'QA', label:'Regression Prevention', text:'Converting these issues into QA test cases stops the same defects returning in future releases.' },
  ];

  impacts.forEach(({ icon, label, text }, i) => {
    const col = i < 2 ? 0 : 1;
    const row = i % 3;
    const x = 0.3 + col * 4.9;
    const y = 1.15 + row * 1.7;
    impact.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x, y, w:4.6, h:1.5, rectRadius:0.1, fill:{ color: K.offWhite }, line:{ color:'D1DCE8', width:0.5 } });
    impact.addText(icon, { x: x+0.12, y: y+0.08, w:0.5, h:0.5, fontSize:22, valign:'middle' });
    impact.addText(label, { x: x+0.65, y: y+0.1, w:3.8, h:0.32, fontSize:12, fontFace:'Calibri', bold:true, color: K.navy });
    impact.addText(text, { x: x+0.65, y: y+0.42, w:3.8, h:0.9, fontSize:9, fontFace:'Calibri', color: K.darkGrey, lineSpacingMultiple:1.3, valign:'top' });
  });
  addPageNum(impact, n);

  // ══════════════════════════════════════════════════
  // SLIDE 5 — PRIORITY MATRIX
  // ══════════════════════════════════════════════════
  n++;
  const pri = lightSlide(pptx);
  addLogo(pri);
  addSlideTitle(pri, 'Priority Matrix', 'Sprint planning guide — assign the right issues to the right sprint');

  const quadrants = [
    { label:'Critical Blockers',  sub:'Fix This Sprint',    issues: critical,  color: K.critical, bg: K.criticalBg, x:0.3, y:1.15, w:4.65, h:2.9 },
    { label:'High Priority',      sub:'Next Sprint',        issues: high,      color: K.high,     bg: K.highBg,     x:5.1,  y:1.15, w:4.65, h:2.9 },
    { label:'Medium Priority',    sub:'This Quarter',       issues: medium,    color: K.medium,   bg: K.mediumBg,   x:0.3,  y:4.2,  w:4.65, h:2.9 },
    { label:'Quick Wins',         sub:'Fix Today < 30min',  issues: quickWins, color: K.teal,     bg: K.passBg,     x:5.1,  y:4.2,  w:4.65, h:2.9 },
  ];

  quadrants.forEach(({ label, sub, issues: qIssues, color, bg, x, y, w, h }) => {
    pri.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x, y, w, h, rectRadius:0.1, fill:{ color: bg }, line:{ color, width:1.5 } });
    pri.addText(label, { x: x+0.1, y: y+0.1, w: w-0.2, h:0.35, fontSize:12, fontFace:'Calibri', bold:true, color, align:'left' });
    pri.addText(`(${qIssues.length} issues — ${sub})`, { x: x+0.1, y: y+0.42, w: w-0.2, h:0.22, fontSize:8, fontFace:'Calibri', color, italic:true });
    pri.addShape('rect' as unknown as PptxGenJS.ShapeType, { x: x+0.1, y: y+0.68, w: w-0.2, h:0.02, fill:{ color } });
    qIssues.slice(0, 6).forEach((iss, i) => {
      pri.addText(`• ${iss.title.substring(0,52)}`, { x: x+0.12, y: y+0.76 + i*0.33, w: w-0.25, h:0.3, fontSize:8.5, fontFace:'Calibri', color: K.nearBlack });
    });
    if (qIssues.length > 6) pri.addText(`+${qIssues.length - 6} more — see Issue Backlog`, { x: x+0.12, y: y+h-0.38, w: w-0.25, h:0.28, fontSize:8, fontFace:'Calibri', color, italic:true });
  });
  addPageNum(pri, n);

  // ══════════════════════════════════════════════════
  // SLIDE 6 — COMPONENT FINDINGS
  // ══════════════════════════════════════════════════
  n++;
  const compFn = (i: AccessibilityIssue) => {
    const t = (i.title + ' ' + i.element).toLowerCase();
    if (t.includes('button') || t.includes('btn')) return 'Buttons';
    if (t.includes('form') || t.includes('input') || t.includes('select')) return 'Forms';
    if (t.includes('modal') || t.includes('dialog')) return 'Modals';
    if (t.includes('nav') || t.includes('link')) return 'Navigation';
    if (t.includes('img') || t.includes('alt')) return 'Images';
    if (t.includes('heading')) return 'Headings';
    if (t.includes('color') || t.includes('contrast')) return 'Colour';
    if (t.includes('focus') || t.includes('keyboard')) return 'Focus/KB';
    return 'Other';
  };
  const byComp: Record<string, AccessibilityIssue[]> = {};
  issues.forEach(i => { const c = compFn(i); if (!byComp[c]) byComp[c] = []; byComp[c].push(i); });
  const topComponents = Object.entries(byComp).sort((a,b) => b[1].length - a[1].length).slice(0, 6);

  const comp = lightSlide(pptx);
  addLogo(comp);
  addSlideTitle(comp, 'Component-Level Findings', 'Fix the component once — resolve all instances across every page');

  topComponents.forEach(([name, cIssues], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.3 + col * 3.15;
    const y = 1.15 + row * 2.95;
    const critC = cIssues.filter(x => x.severity === 'critical').length;
    const dsImpact = cIssues.length >= 3;
    const topColor = critC > 0 ? K.critical : dsImpact ? K.high : K.navy;

    comp.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x, y, w:3.0, h:2.7, rectRadius:0.1, fill:{ color: K.offWhite }, line:{ color:'D1DCE8', width:0.5 } });
    comp.addShape('rect' as unknown as PptxGenJS.ShapeType, { x, y, w:3.0, h:0.06, fill:{ color: topColor } });
    comp.addText(name, { x: x+0.12, y: y+0.12, w:2.2, h:0.35, fontSize:13, fontFace:'Calibri', bold:true, color: K.nearBlack });
    comp.addText(String(cIssues.length), { x: x+2.3, y: y+0.1, w:0.6, h:0.4, fontSize:24, fontFace:'Calibri', bold:true, color:topColor, align:'center' });
    if (dsImpact) comp.addText('DS Impact', { x: x+0.12, y: y+0.48, w:2.7, h:0.22, fontSize:8.5, fontFace:'Calibri', bold:true, color: K.high });
    const sevText = (['critical','high','medium','low'] as const).filter(s => cIssues.some(i => i.severity === s)).map(s => `${cIssues.filter(i=>i.severity===s).length} ${s}`).join('  ');
    comp.addText(sevText, { x: x+0.12, y: y+0.72, w:2.7, h:0.22, fontSize:8, fontFace:'Calibri', color: K.darkGrey });
    comp.addShape('rect' as unknown as PptxGenJS.ShapeType, { x: x+0.1, y: y+0.97, w:2.8, h:0.01, fill:{ color:'D1DCE8' } });
    cIssues.slice(0, 4).forEach((iss, j) => {
      comp.addText(`• ${iss.title.substring(0,38)}`, { x: x+0.12, y: y+1.05 + j*0.38, w:2.8, h:0.34, fontSize:8, fontFace:'Calibri', color: K.darkGrey });
    });
  });
  addPageNum(comp, n);

  // ══════════════════════════════════════════════════
  // SLIDE 7 — REMEDIATION BY TEAM
  // ══════════════════════════════════════════════════
  n++;
  const rem = lightSlide(pptx);
  addLogo(rem);
  addSlideTitle(rem, 'Remediation Responsibility', 'Each issue routed to the team who can fix it');

  const byTeam: Record<string, AccessibilityIssue[]> = {};
  issues.forEach(i => { const t = deriveTeam(i); if (!byTeam[t]) byTeam[t] = []; byTeam[t].push(i); });

  const teamEntries = Object.entries(byTeam).sort((a,b) => b[1].length - a[1].length).slice(0,6);
  teamEntries.forEach(([team, tIssues], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.3 + col * 3.15;
    const y = 1.15 + row * 2.95;
    const c = TEAM_COLOR[team] || K.lightBlue;
    const critCount = tIssues.filter(x => x.severity === 'critical').length;

    rem.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x, y, w:3.0, h:2.7, rectRadius:0.1, fill:{ color: K.offWhite }, line:{ color:'D1DCE8', width:0.5 } });
    rem.addShape('rect' as unknown as PptxGenJS.ShapeType, { x, y, w:3.0, h:0.06, fill:{ color:`${c}` } });
    rem.addText(team, { x: x+0.12, y: y+0.12, w:2.2, h:0.35, fontSize:12, fontFace:'Calibri', bold:true, color: K.nearBlack });
    rem.addText(String(tIssues.length), { x: x+2.3, y: y+0.1, w:0.6, h:0.4, fontSize:24, fontFace:'Calibri', bold:true, color:`${c}`, align:'center' });
    if (critCount > 0) {
      rem.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x: x+0.12, y: y+0.5, w:1.5, h:0.25, rectRadius:0.04, fill:{ color: K.criticalBg }, line:{ color: K.critical, width:0.5 } });
      rem.addText(`${critCount} Critical`, { x: x+0.12, y: y+0.5, w:1.5, h:0.25, fontSize:8, fontFace:'Calibri', bold:true, color: K.critical, align:'center', valign:'middle' });
    }
    rem.addShape('rect' as unknown as PptxGenJS.ShapeType, { x: x+0.1, y: y+0.82, w:2.8, h:0.01, fill:{ color:'D1DCE8' } });
    tIssues.slice(0, 4).forEach((iss, j) => {
      rem.addText(`• ${iss.title.substring(0,38)}`, { x: x+0.12, y: y+0.9 + j*0.38, w:2.8, h:0.34, fontSize:8, fontFace:'Calibri', color: K.darkGrey });
    });
  });
  addPageNum(rem, n);

  // ══════════════════════════════════════════════════
  // SLIDE 8 — ISSUE TABLE SLIDES (10 per slide)
  // ══════════════════════════════════════════════════
  const perPage = 10;
  for (let batch = 0; batch < issues.length; batch += perPage) {
    n++;
    const batchIssues = issues.slice(batch, batch + perPage);
    const tableSlide = lightSlide(pptx);
    addLogo(tableSlide);
    addSlideTitle(tableSlide, `Issue Backlog${batch === 0 ? '' : ' (cont.)'}`, `Issues ${batch+1}–${Math.min(batch+perPage, issues.length)} of ${issues.length}`);

    const headerRow: PptxGenJS.TableRow = [
      { text:'#',          options:{ bold:true, color:K.white, fill:{ color:K.navy }, fontSize:8, align:'center' } },
      { text:'Title',      options:{ bold:true, color:K.white, fill:{ color:K.navy }, fontSize:8 } },
      { text:'WCAG',       options:{ bold:true, color:K.white, fill:{ color:K.navy }, fontSize:8, align:'center' } },
      { text:'Severity',   options:{ bold:true, color:K.white, fill:{ color:K.navy }, fontSize:8, align:'center' } },
      { text:'Team Owner', options:{ bold:true, color:K.white, fill:{ color:K.navy }, fontSize:8 } },
      { text:'Effort',     options:{ bold:true, color:K.white, fill:{ color:K.navy }, fontSize:8, align:'center' } },
    ];

    const dataRows: PptxGenJS.TableRow[] = batchIssues.map((iss, idx) => [
      { text:`#${String(batch+idx+1).padStart(3,'0')}`, options:{ fontSize:8, bold:true, color:K.nearBlack, align:'center' as const, fill:{ color: idx%2===0 ? K.offWhite : K.white } } },
      { text:iss.title.substring(0,55), options:{ fontSize:8, color:K.nearBlack, fill:{ color: idx%2===0 ? K.offWhite : K.white } } },
      { text:`${iss.wcagCriterion} (${iss.wcagLevel})`, options:{ fontSize:8, color:K.lightBlue, fill:{ color: idx%2===0 ? K.offWhite : K.white } } },
      { text:iss.severity.toUpperCase(), options:{ fontSize:8, bold:true, color:sevColor(iss.severity), fill:{ color:sevBg(iss.severity) }, align:'center' as const } },
      { text:deriveTeam(iss), options:{ fontSize:8, color:K.nearBlack, fill:{ color: idx%2===0 ? K.offWhite : K.white } } },
      { text:deriveEffort(iss), options:{ fontSize:8, color:K.darkGrey, fill:{ color: idx%2===0 ? K.offWhite : K.white }, align:'center' as const } },
    ]);

    tableSlide.addTable([headerRow, ...dataRows], {
      x:0.3, y:1.1, w:9.4,
      colW:[0.65, 3.4, 1.1, 0.95, 1.7, 1.0],
      border:{ type:'solid', pt:0.4, color:'D1DCE8' },
      rowH: batchIssues.length <= 8 ? 0.56 : 0.48,
      autoPage:false,
    });

    addPageNum(tableSlide, n);
  }

  } // end isA11y slides

  // ══════════════════════════════════════════════════
  // SLIDE — NEXT STEPS & THANK YOU
  // ══════════════════════════════════════════════════
  n++;
  const end = darkSlide(pptx);
  end.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0, y:1.0, w:0.07, h:5.5, fill:{ color: K.lightBlue } });
  end.addText('Next Steps', { x:0.4, y:1.3, w:9, h:0.7, fontSize:36, fontFace:'Calibri', bold:true, color: K.white });
  end.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0.4, y:2.1, w:2.0, h:0.035, fill:{ color: K.lightBlue } });

  const steps = [
    ['01', 'Assign critical blockers to Sprint 1 backlog — schedule immediately.'],
    ['02', 'Route each issue to the correct team owner using the Issue Backlog tab.'],
    ['03', 'Fix design-system-level issues once to resolve all instances site-wide.'],
    ['04', 'Add "Done When" criteria to each ticket as acceptance criteria.'],
    ['05', 'Add axe-core to CI/CD — run on every pull request to catch regressions.'],
    ['06', 'Schedule a verification audit after Sprint 2 to confirm fixes are complete.'],
  ];
  steps.forEach(([num, text], i) => {
    const y = 2.3 + i * 0.68;
    end.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x:0.4, y, w:0.44, h:0.44, rectRadius:0.06, fill:{ color: K.navy } });
    end.addText(num, { x:0.4, y, w:0.44, h:0.44, fontSize:10, fontFace:'Calibri', bold:true, color: K.white, align:'center', valign:'middle' });
    end.addText(text, { x:0.95, y: y+0.04, w:8.6, h:0.36, fontSize:10.5, fontFace:'Calibri', color: K.midGrey });
  });

  end.addText(`KPMG ${reportTitle} — Confidential`, { x:0, y:6.85, w:10, h:0.25, fontSize:8, fontFace:'Calibri', color: K.midGrey, align:'center', italic:true });
  addPageNum(end, n);

  // ══════════════════════════════════════════════════
  // DARK PATTERN SLIDES (if DP pillar selected)
  // ══════════════════════════════════════════════════
  if (isDP && dpFindings.length > 0) {
    // Section divider
    n++;
    const dpDiv = darkSlide(pptx);
    addLogo(dpDiv);
    dpDiv.addText('Dark Pattern', { x:0.4, y:2.5, w:9, h:0.7, fontSize:38, fontFace:'Calibri', bold:true, color: K.white });
    dpDiv.addText('Findings', { x:0.4, y:3.15, w:9, h:0.5, fontSize:30, fontFace:'Calibri', color: 'C084FC' });
    dpDiv.addText(`${dpFindings.length} pattern(s) detected across audited pages`, { x:0.4, y:3.8, w:9, h:0.35, fontSize:13, fontFace:'Calibri', color: K.midGrey });
    addPageNum(dpDiv, n);

    // Summary KPI slide
    n++;
    const dpKpi = darkSlide(pptx);
    addLogo(dpKpi);
    dpKpi.addText('Dark Pattern Intelligence', { x:0.4, y:0.22, w:9, h:0.55, fontSize:24, fontFace:'Calibri', bold:true, color: K.white });
    dpKpi.addShape('rect' as unknown as PptxGenJS.ShapeType, { x:0.4, y:0.82, w:1.8, h:0.035, fill:{ color: 'C084FC' } });

    const dpResult = (audit as any).pillarResults?.darkpatterns;
    const kpis = [
      { label: 'Ethics Score',       value: String(dpResult?.ethicsScore ?? '—'),       color: dpResult?.ethicsScore >= 80 ? K.teal : K.critical },
      { label: 'Total Findings',     value: String(dpFindings.length),                   color: dpFindings.length === 0 ? K.teal : K.critical },
      { label: 'Consent Integrity',  value: String(dpResult?.consentIntegrity ?? '—'),   color: dpResult?.consentIntegrity >= 80 ? K.teal : K.medium },
      { label: 'Manipulation Index', value: String(dpResult?.manipulationIndex ?? '—'),  color: dpResult?.manipulationIndex <= 20 ? K.teal : K.critical },
    ];
    kpis.forEach(({ label, value, color }, i) => {
      const x = 0.4 + i * 2.3;
      dpKpi.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x, y:1.1, w:2.1, h:1.4, rectRadius:0.1, fill:{ color: K.bgCard }, line:{ color, width:1 } });
      dpKpi.addText(value, { x, y:1.15, w:2.1, h:0.85, fontSize:36, fontFace:'Calibri', bold:true, color, align:'center', valign:'middle' });
      dpKpi.addText(label.toUpperCase(), { x, y:2.0, w:2.1, h:0.35, fontSize:8, fontFace:'Calibri', bold:true, color, align:'center' });
    });

    // Category breakdown
    const catBreakdown = dpResult?.categoryBreakdown || {};
    const topCats = Object.entries(catBreakdown as Record<string,number>)
      .filter(([, v]) => v > 0)
      .sort(([,a],[,b]) => b - a)
      .slice(0, 6);
    topCats.forEach(([cat, count], i) => {
      const col = i % 3; const row = Math.floor(i / 3);
      const x = 0.4 + col * 3.15; const y = 2.9 + row * 1.6;
      dpKpi.addShape('roundRect' as unknown as PptxGenJS.ShapeType, { x, y, w:3.0, h:1.4, rectRadius:0.08, fill:{ color: K.bgCard }, line:{ color:'C084FC', width:0.5 } });
      dpKpi.addText(String(count), { x: x+0.1, y: y+0.1, w:0.8, h:0.7, fontSize:28, fontFace:'Calibri', bold:true, color:'C084FC', align:'center', valign:'middle' });
      dpKpi.addText(cat.replace(/-/g, ' '), { x: x+0.95, y: y+0.15, w:1.95, h:0.6, fontSize:10, fontFace:'Calibri', bold:true, color: K.white, valign:'middle' });
    });
    addPageNum(dpKpi, n);

    // Finding table slides (10 per slide)
    const dpPerPage = 10;
    for (let batch = 0; batch < dpFindings.length; batch += dpPerPage) {
      n++;
      const batchFindings = dpFindings.slice(batch, batch + dpPerPage);
      const dpSlide = lightSlide(pptx);
      addLogo(dpSlide);
      addSlideTitle(dpSlide, `Dark Pattern Findings${batch === 0 ? '' : ' (cont.)'}`, `Issues ${batch+1}–${Math.min(batch+dpPerPage, dpFindings.length)} of ${dpFindings.length}`);

      const dpHeaderRow: PptxGenJS.TableRow = [
        { text:'#',         options:{ bold:true, color:K.white, fill:{ color:'6A289B' }, fontSize:8, align:'center' } },
        { text:'Finding',   options:{ bold:true, color:K.white, fill:{ color:'6A289B' }, fontSize:8 } },
        { text:'Category',  options:{ bold:true, color:K.white, fill:{ color:'6A289B' }, fontSize:8 } },
        { text:'CCPA',  options:{ bold:true, color:K.white, fill:{ color:'6A289B' }, fontSize:8 } },
        { text:'Severity',  options:{ bold:true, color:K.white, fill:{ color:'6A289B' }, fontSize:8, align:'center' } },
        { text:'Priority',  options:{ bold:true, color:K.white, fill:{ color:'6A289B' }, fontSize:8, align:'center' } },
      ];
      const dpDataRows: PptxGenJS.TableRow[] = batchFindings.map((f, idx) => [
        { text:`#${String(batch+idx+1).padStart(3,'0')}`, options:{ fontSize:8, bold:true, color:K.nearBlack, align:'center' as const, fill:{ color: idx%2===0 ? K.offWhite : K.white } } },
        { text:f.title.substring(0,55), options:{ fontSize:8, color:K.nearBlack, fill:{ color: idx%2===0 ? K.offWhite : K.white } } },
        { text:f.category.replace(/-/g,' '), options:{ fontSize:8, color:K.darkGrey, fill:{ color: idx%2===0 ? K.offWhite : K.white } } },
        { text:f.brignullPattern ? `#${f.brignullNumber} ${f.brignullPattern}` : '—', options:{ fontSize:8, color:'C084FC', fill:{ color: idx%2===0 ? K.offWhite : K.white } } },
        { text:f.severity.toUpperCase(), options:{ fontSize:8, bold:true, color:sevColor(f.severity), fill:{ color:sevBg(f.severity) }, align:'center' as const } },
        { text:f.fixPriority || '—', options:{ fontSize:8, bold:true, color: f.fixPriority === 'P0' ? K.critical : K.high, fill:{ color: idx%2===0 ? K.offWhite : K.white }, align:'center' as const } },
      ]);

      dpSlide.addTable([dpHeaderRow, ...dpDataRows], {
        x:0.3, y:1.1, w:9.4,
        colW:[0.65, 3.3, 1.8, 1.5, 0.95, 0.8],
        border:{ type:'solid', pt:0.4, color:'D1DCE8' },
        rowH: batchFindings.length <= 8 ? 0.56 : 0.48,
        autoPage:false,
      });
      addPageNum(dpSlide, n);
    }

    // Evidence screenshot slides (one per finding that has a screenshot)
    dpFindings.forEach((f, idx) => {
      const screenshotUrl: string | undefined = (f.evidence as any)?.screenshotDataUrl;
      if (!screenshotUrl) return;
      n++;
      const evidSlide = lightSlide(pptx);
      addLogo(evidSlide);
      addSlideTitle(evidSlide, `Evidence: #${String(idx+1).padStart(3,'0')} — ${f.title.substring(0, 50)}`, (f.evidence as any)?.pageUrl || f.pageUrl || '');
      try {
        evidSlide.addImage({ data: screenshotUrl, x:0.3, y:1.1, w:9.4, h:4.8, sizing:{ type:'contain', w:9.4, h:4.8 } });
      } catch (_) { /* skip if image data invalid */ }
      evidSlide.addText(`Severity: ${f.severity.toUpperCase()}   |   Rule: ${f.ruleId || '—'}   |   Pattern: ${f.brignullPattern || 'Custom'}`, { x:0.3, y:6.1, w:9.4, h:0.3, fontSize:8, fontFace:'Calibri', color: K.midGrey });
      addPageNum(evidSlide, n);
    });
  }

  // ── PERFORMANCE SLIDES ───────────────────────────────────────
  if (isPerf) {
    const perfResult = (audit as any).pillarResults?.performance;
    const perfPages: any[] = perfResult?.pages || [];

    // Section divider
    n++;
    const perfDivSlide = darkSlide(pptx);
    addLogo(perfDivSlide, true);
    perfDivSlide.addText('Performance Findings', { x:1, y:2.8, w:8, h:1, fontSize:40, fontFace:'Calibri', bold:true, color:K.teal });
    perfDivSlide.addText(`Overall Score: ${perfResult?.overallScore ?? '—'}/100  ·  ${perfPages.length} page(s) analysed`, { x:1, y:3.9, w:8, h:0.5, fontSize:16, fontFace:'Calibri', color:K.midGrey });
    addPageNum(perfDivSlide, n);

    // KPI summary slide
    if (perfResult) {
      n++;
      const kpiSlide = lightSlide(pptx);
      addLogo(kpiSlide);
      addSlideTitle(kpiSlide, 'Performance KPIs', `Overall score: ${perfResult.overallScore ?? '—'}/100 · Total resource issues: ${perfResult.totalResourceIssues ?? 0}`);
      const avg = perfResult.averageVitals || {};
      const kpiRows: any[][] = [
        [{ text:'Metric', options:{bold:true, color:K.white, fill:K.navy} }, { text:'Average Value', options:{bold:true, color:K.white, fill:K.navy} }, { text:'Threshold (Good)', options:{bold:true, color:K.white, fill:K.navy} }],
        ['LCP (ms)', avg.lcp != null ? String(Math.round(avg.lcp)) : '—', '≤ 2500'],
        ['CLS', avg.cls != null ? avg.cls.toFixed(3) : '—', '≤ 0.10'],
        ['FCP (ms)', avg.fcp != null ? String(Math.round(avg.fcp)) : '—', '≤ 1800'],
        ['TTFB (ms)', avg.ttfb != null ? String(Math.round(avg.ttfb)) : '—', '≤ 800'],
        ['INP (ms)', avg.inp != null ? String(Math.round(avg.inp)) : '—', '≤ 200'],
        ['TBT (ms)', avg.tbt != null ? String(Math.round(avg.tbt)) : '—', '≤ 200'],
      ];
      kpiSlide.addTable(kpiRows, { x:0.3, y:1.2, w:9.4, colW:[3.5,2.5,3.4], fontSize:10, fontFace:'Calibri', border:{type:'solid',pt:0.5,color:K.lightGrey}, fill:{color:K.offWhite} });
      addPageNum(kpiSlide, n);
    }

    // Page vitals table slides (8 pages per slide)
    if (perfPages.length > 0) {
      const PAGE_CHUNK = 8;
      for (let i = 0; i < perfPages.length; i += PAGE_CHUNK) {
        n++;
        const chunk = perfPages.slice(i, i + PAGE_CHUNK);
        const pvSlide = lightSlide(pptx);
        addLogo(pvSlide);
        addSlideTitle(pvSlide, 'Page Performance Vitals', `Pages ${i + 1}–${Math.min(i + PAGE_CHUNK, perfPages.length)} of ${perfPages.length}`);
        const rows: any[][] = [
          [
            {text:'Page', options:{bold:true,color:K.white,fill:K.navy}},
            {text:'Score', options:{bold:true,color:K.white,fill:K.navy}},
            {text:'LCP (ms)', options:{bold:true,color:K.white,fill:K.navy}},
            {text:'CLS', options:{bold:true,color:K.white,fill:K.navy}},
            {text:'FCP (ms)', options:{bold:true,color:K.white,fill:K.navy}},
            {text:'Resource Issues', options:{bold:true,color:K.white,fill:K.navy}},
          ],
          ...chunk.map((pg: any) => [
            (pg.title || pg.url || '').substring(0, 35),
            String(pg.score ?? '—'),
            pg.vitals?.lcp != null ? String(Math.round(pg.vitals.lcp)) : '—',
            pg.vitals?.cls != null ? pg.vitals.cls.toFixed(3) : '—',
            pg.vitals?.fcp != null ? String(Math.round(pg.vitals.fcp)) : '—',
            String(pg.resourceIssues?.length ?? 0),
          ]),
        ];
        pvSlide.addTable(rows, { x:0.3, y:1.2, w:9.4, colW:[3.5,0.9,1.3,0.9,1.3,1.5], fontSize:9, fontFace:'Calibri', border:{type:'solid',pt:0.5,color:K.lightGrey} });
        addPageNum(pvSlide, n);
      }
    }

    // Recommendations slide
    const recs = ((perfResult?.recommendations || []) as RecommendationItem[]).slice(0, 10);
    if (recs.length > 0) {
      n++;
      const recSlide = lightSlide(pptx);
      addLogo(recSlide);
      addSlideTitle(recSlide, 'Performance Recommendations', `Top ${recs.length} recommendations to improve Core Web Vitals`);
      const recRows: any[][] = [
        [
          {text:'Priority', options:{bold:true,color:K.white,fill:'006E51'}},
          {text:'Recommendation', options:{bold:true,color:K.white,fill:'006E51'}},
          {text:'Effort', options:{bold:true,color:K.white,fill:'006E51'}},
          {text:'Impact', options:{bold:true,color:K.white,fill:'006E51'}},
        ],
        ...recs.map((r) => [
          r.priority,
          `${r.title} — ${r.detail}`.substring(0, 75),
          r.effort,
          r.impact,
        ]),
      ];
      recSlide.addTable(recRows, { x:0.3, y:1.2, w:9.4, colW:[1.1,5.5,1.5,1.3], fontSize:8.5, fontFace:'Calibri', border:{type:'solid',pt:0.5,color:K.lightGrey} });
      addPageNum(recSlide, n);
    }

    // Network simulation slide
    if (perfResult?.networkSimulation?.length > 0) {
      n++;
      const netSlide = lightSlide(pptx);
      addLogo(netSlide);
      addSlideTitle(netSlide, 'Network Simulation Results', 'Performance across connectivity conditions');
      const netRows: any[][] = [
        [
          {text:'Condition', options:{bold:true,color:K.white,fill:K.navy}},
          {text:'LCP (ms)', options:{bold:true,color:K.white,fill:K.navy}},
          {text:'FCP (ms)', options:{bold:true,color:K.white,fill:K.navy}},
          {text:'TTFB (ms)', options:{bold:true,color:K.white,fill:K.navy}},
          {text:'Score', options:{bold:true,color:K.white,fill:K.navy}},
        ],
        ...(perfResult.networkSimulation as any[]).map((sim: any) => [
          sim.label || sim.preset,
          sim.lcp != null ? String(Math.round(sim.lcp)) : '—',
          sim.fcp != null ? String(Math.round(sim.fcp)) : '—',
          sim.ttfb != null ? String(Math.round(sim.ttfb)) : '—',
          sim.score != null ? String(sim.score) : '—',
        ]),
      ];
      netSlide.addTable(netRows, { x:0.3, y:1.2, w:9.4, colW:[2.8,1.7,1.7,1.7,1.5], fontSize:10, fontFace:'Calibri', border:{type:'solid',pt:0.5,color:K.lightGrey} });
      addPageNum(netSlide, n);
    }
  }

  // ── PRIVACY SLIDES ───────────────────────────────────────────
  if (isPriv) {
    const privResult = (audit as any).pillarResults?.privacy;
    const privFindings: any[] = privResult?.findings || [];

    // Section divider
    n++;
    const privDivSlide = darkSlide(pptx);
    addLogo(privDivSlide, true);
    privDivSlide.addText('Privacy & Compliance Findings', { x:1, y:2.8, w:8, h:1, fontSize:36, fontFace:'Calibri', bold:true, color:'E8A33A' });
    privDivSlide.addText(`Score: ${privResult?.overallScore ?? '—'}/100  ·  ${privFindings.length} finding(s)  ·  Trackers: ${privResult?.totalTrackers ?? 0}`, { x:1, y:3.9, w:8, h:0.5, fontSize:16, fontFace:'Calibri', color:K.midGrey });
    addPageNum(privDivSlide, n);

    // Findings table slides (10 per slide)
    if (privFindings.length > 0) {
      const CHUNK = 10;
      for (let i = 0; i < privFindings.length; i += CHUNK) {
        n++;
        const chunk = privFindings.slice(i, i + CHUNK);
        const pfSlide = lightSlide(pptx);
        addLogo(pfSlide);
        addSlideTitle(pfSlide, 'Privacy Findings', `${i + 1}–${Math.min(i + CHUNK, privFindings.length)} of ${privFindings.length}`);
        const rows: any[][] = [
          [
            {text:'#', options:{bold:true,color:K.white,fill:'B45309'}},
            {text:'Finding', options:{bold:true,color:K.white,fill:'B45309'}},
            {text:'Category', options:{bold:true,color:K.white,fill:'B45309'}},
            {text:'Regulation', options:{bold:true,color:K.white,fill:'B45309'}},
            {text:'Severity', options:{bold:true,color:K.white,fill:'B45309'}},
          ],
          ...chunk.map((f: any, idx: number) => [
            `#${String(i + idx + 1).padStart(3, '0')}`,
            (f.title || '—').substring(0, 40),
            (f.category || '—').substring(0, 20),
            Array.isArray(f.regulation) ? f.regulation.slice(0, 2).join(', ') : (f.regulation || '—'),
            (f.severity || '—').toUpperCase(),
          ]),
        ];
        pfSlide.addTable(rows, { x:0.3, y:1.2, w:9.4, colW:[0.8,3.6,2,2,1], fontSize:9, fontFace:'Calibri', border:{type:'solid',pt:0.5,color:K.lightGrey} });
        addPageNum(pfSlide, n);
      }
    }

    // Trackers slide
    const trackers = (privResult?.trackers || []) as any[];
    if (trackers.length > 0) {
      n++;
      const tkSlide = lightSlide(pptx);
      addLogo(tkSlide);
      addSlideTitle(tkSlide, 'Trackers Detected', `${trackers.length} third-party tracker(s) found`);
      const tkRows: any[][] = [
        [
          {text:'Domain', options:{bold:true,color:K.white,fill:K.navy}},
          {text:'Company', options:{bold:true,color:K.white,fill:K.navy}},
          {text:'Category', options:{bold:true,color:K.white,fill:K.navy}},
          {text:'Requests', options:{bold:true,color:K.white,fill:K.navy}},
        ],
        ...trackers.slice(0, 15).map((t: any) => [
          t.domain || '—',
          t.company || '—',
          t.category || '—',
          String(t.requestCount || 0),
        ]),
      ];
      tkSlide.addTable(tkRows, { x:0.3, y:1.2, w:9.4, colW:[3,3,2.2,1.2], fontSize:9.5, fontFace:'Calibri', border:{type:'solid',pt:0.5,color:K.lightGrey} });
      addPageNum(tkSlide, n);
    }
  }

  const data = await pptx.write({ outputType:'nodebuffer' });
  return data as Buffer;
}
