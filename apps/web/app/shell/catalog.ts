import type { LucideIcon } from 'lucide-react';

import type { NavigationKey } from './navigation-messages';

export type NavigationIcon =
  | 'observatory'
  | 'workspace'
  | 'state'
  | 'visualization'
  | 'analytics'
  | 'ml'
  | 'memory'
  | 'knowledge'
  | 'ai'
  | 'assessment'
  | 'collaboration'
  | 'data'
  | 'research'
  | 'instrumentation'
  | 'visualLab'
  | 'reports'
  | 'system'
  | 'settings';

export interface NavigationItem {
  readonly key: NavigationKey;
  readonly href: string;
  readonly available: boolean;
}

export interface NavigationSection {
  readonly key: NavigationKey;
  readonly icon: NavigationIcon;
  readonly items: readonly NavigationItem[];
}

const item = (
  key: NavigationKey,
  slug: string,
  available = false,
): NavigationItem => ({
  key,
  href: available ? (slug === 'overview' ? '/' : '/app') : `/${slug}`,
  available,
});

export const navigationCatalog: readonly NavigationSection[] = [
  {
    key: 'observatory',
    icon: 'observatory',
    items: [
      item('overview', 'overview', true),
      item('commandCenter', 'observatory/command-center'),
      item('systemStatus', 'observatory/system-status'),
    ],
  },
  {
    key: 'workspace',
    icon: 'workspace',
    items: [
      item('projects', 'projects', true),
      item('profiles', 'profiles', true),
      item('experiments', 'workspace/experiments'),
      item('sessions', 'workspace/sessions'),
    ],
  },
  {
    key: 'stateEngine',
    icon: 'state',
    items: [
      item('currentState', 'current-state', true),
      item('stateHistory', 'state-engine/state-history'),
      item('transitions', 'state-engine/transitions'),
      item('dynamics', 'state-engine/dynamics'),
      item('modelVersions', 'state-engine/model-versions'),
    ],
  },
  {
    key: 'visualization',
    icon: 'visualization',
    items: [
      item('emotionState', 'visualization/emotion-state'),
      item('emotionMap', 'visualization/emotion-map'),
      item('valenceArousal', 'visualization/valence-arousal'),
      item('temporalView', 'visualization/temporal-view'),
      item('emotionTimeline', 'visualization/emotion-timeline'),
      item('stateComparison', 'visualization/state-comparison'),
      item('visualizationLab', 'visualization/lab'),
    ],
  },
  {
    key: 'analytics',
    icon: 'analytics',
    items: [
      item('advancedAnalytics', 'analytics/advanced'),
      item('trends', 'analytics/trends'),
      item('statistics', 'analytics/statistics'),
      item('comparisons', 'analytics/comparisons'),
      item('correlations', 'analytics/correlations'),
      item('patternAnalysis', 'analytics/pattern-analysis'),
      item('analyticsLab', 'analytics/lab'),
    ],
  },
  {
    key: 'machineLearning',
    icon: 'ml',
    items: [
      item('models', 'ml/models'),
      item('modelRegistry', 'ml/model-registry'),
      item('training', 'ml/training'),
      item('datasets', 'ml/datasets'),
      item('experiments', 'ml/experiments'),
      item('evaluation', 'ml/evaluation'),
      item('modelComparison', 'ml/model-comparison'),
      item('mlDiagnostics', 'ml/diagnostics'),
    ],
  },
  {
    key: 'memory',
    icon: 'memory',
    items: [
      item('memory', 'memory'),
      item('memoryTimeline', 'memory/timeline'),
      item('memoryGraph', 'memory/graph'),
      item('context', 'memory/context'),
      item('provenance', 'memory/provenance'),
    ],
  },
  {
    key: 'knowledgeRag',
    icon: 'knowledge',
    items: [
      item('knowledgeBase', 'knowledge/knowledge-base'),
      item('sources', 'knowledge/sources'),
      item('documents', 'knowledge/documents'),
      item('retrieval', 'knowledge/retrieval'),
      item('ragEvaluation', 'knowledge/rag-evaluation'),
      item('provenance', 'knowledge/provenance'),
    ],
  },
  {
    key: 'aiIntelligence',
    icon: 'ai',
    items: [
      item('aiChat', 'ai/chat'),
      item('aiInsights', 'ai/insights'),
      item('recommendations', 'ai/recommendations'),
      item('aiAnalysis', 'ai/analysis'),
      item('reasoningEvidence', 'ai/reasoning-evidence'),
    ],
  },
  {
    key: 'assessment',
    icon: 'assessment',
    items: [
      item('psychologicalAssessment', 'assessment/psychological'),
      item('behavioralEvaluation', 'assessment/behavioral'),
      item('assessmentHistory', 'assessment/history'),
      item('assessmentReports', 'assessment/reports'),
    ],
  },
  {
    key: 'collaboration',
    icon: 'collaboration',
    items: [
      item('team', 'collaboration/team'),
      item('sharedProjects', 'collaboration/shared-projects'),
      item('researchSessions', 'collaboration/research-sessions'),
      item('comments', 'collaboration/comments'),
      item('activity', 'collaboration/activity'),
      item('review', 'collaboration/review'),
    ],
  },
  {
    key: 'data',
    icon: 'data',
    items: [
      item('events', 'data/events'),
      item('observations', 'data/observations'),
      item('dataSources', 'data/sources'),
      item('imports', 'data/imports'),
      item('exports', 'data/exports'),
      item('dataQuality', 'data/quality'),
      item('dataExplorer', 'data/explorer'),
    ],
  },
  {
    key: 'research',
    icon: 'research',
    items: [
      item('researchHub', 'research/hub'),
      item('experiments', 'research/experiments'),
      item('runs', 'research/runs'),
      item('evidence', 'research/evidence'),
      item('reproducibility', 'research/reproducibility'),
      item('researchEvaluation', 'research/evaluation'),
      item('researchNotes', 'research/notes'),
      item('audit', 'research/audit'),
    ],
  },
  {
    key: 'instrumentation',
    icon: 'instrumentation',
    items: [
      item('liveMonitor', 'instrumentation/live-monitor'),
      item('signals', 'instrumentation/signals'),
      item('parameters', 'instrumentation/parameters'),
      item('schematics', 'instrumentation/schematics'),
      item('calibration', 'instrumentation/calibration'),
      item('diagnostics', 'instrumentation/diagnostics'),
    ],
  },
  {
    key: 'visualLab',
    icon: 'visualLab',
    items: [
      item('emotionVisualizations', 'visual-lab/emotion-visualizations'),
      item('dynamicEmotionField', 'visual-lab/dynamic-emotion-field'),
      item('emotionParticles', 'visual-lab/emotion-particles'),
      item('emotionalLandscape', 'visual-lab/emotional-landscape'),
      item('statePulse', 'visual-lab/state-pulse'),
      item('interactiveEmotionMap', 'visual-lab/interactive-emotion-map'),
      item('experimentalVisuals', 'visual-lab/experimental-visuals'),
    ],
  },
  {
    key: 'reports',
    icon: 'reports',
    items: [
      item('researchReports', 'reports/research'),
      item('assessmentReports', 'reports/assessment'),
      item('analyticsReports', 'reports/analytics'),
      item('exportCenter', 'reports/export-center'),
    ],
  },
  {
    key: 'system',
    icon: 'system',
    items: [
      item('modelConfiguration', 'system/model-configuration'),
      item('systemConfiguration', 'system/configuration'),
      item('security', 'system/security'),
      item('auditLog', 'system/audit-log'),
      item('api', 'system/api'),
      item('integrations', 'system/integrations'),
    ],
  },
  {
    key: 'settings',
    icon: 'settings',
    items: [
      item('account', 'settings/account'),
      item('workspaceSettings', 'settings/workspace'),
      item('appearanceSettings', 'settings/appearance'),
      item('languageSettings', 'settings/language'),
      item('notifications', 'settings/notifications'),
      item('accessibility', 'settings/accessibility'),
    ],
  },
];

export const allNavigationItems = navigationCatalog.flatMap(
  (section) => section.items,
);

export function findNavigationItem(path: string): NavigationItem | undefined {
  return allNavigationItems.find((entry) => entry.href === path);
}

export type { LucideIcon };