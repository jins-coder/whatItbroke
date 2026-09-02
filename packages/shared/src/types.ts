/**
 * WhatItBroke - Universal Application Debugger
 * Shared Type Definitions
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorInfo {
  name: string;
  message: string;
  rawStack?: string;
  type?: string;
  code?: string | number;
  cause?: unknown;
  handled?: boolean;
  timestamp: number;
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  functionName?: string;
  className?: string;
  snippet?: SourceSnippet;
  sourceMapped?: boolean;
  originalFile?: string;
  originalLine?: number;
  originalColumn?: number;
}

export interface SourceSnippet {
  lines: {
    lineNumber: number;
    content: string;
    isErrorLine: boolean;
  }[];
  highlightRange?: {
    startCol: number;
    endCol: number;
  };
}

export interface StackFrame {
  file: string;
  line: number;
  column: number;
  functionName: string;
  isNative?: boolean;
  isNodeModules?: boolean;
  isFrameworkInternal?: boolean;
  sourceSnippet?: SourceSnippet;
  originalPosition?: {
    file: string;
    line: number;
    column: number;
    functionName?: string;
  };
}

export interface RuntimeContext {
  environment: 'node' | 'browser' | 'deno' | 'bun' | 'electron' | 'unknown';
  platform?: string;
  version?: string;
  arch?: string;
  nodeVersion?: string;
  memoryUsage?: {
    heapUsed?: number;
    heapTotal?: number;
    rss?: number;
    external?: number;
  };
  uptime?: number;
  processId?: number;
  activeHandlesCount?: number;
}

export interface ExecutionStep {
  id: string;
  timestamp: number;
  category: 'request' | 'controller' | 'service' | 'database' | 'render' | 'hook' | 'network' | 'custom';
  name: string;
  file?: string;
  line?: number;
  args?: Record<string, unknown>;
  returnValue?: unknown;
  stateSnapshot?: Record<string, unknown>;
  failed?: boolean;
  description: string;
}

export type TimelineEventType =
  | 'request_start'
  | 'request_end'
  | 'api_request'
  | 'api_response'
  | 'db_query_start'
  | 'db_query_end'
  | 'state_update'
  | 'component_render'
  | 'hook_call'
  | 'custom_breadcrumb'
  | 'undefined_value_detected'
  | 'exception'
  | 'performance_issue'
  | 'warning_log'
  | 'info_log';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  timeOffsetMs?: number;
  type: TimelineEventType;
  summary: string;
  details?: Record<string, unknown>;
  file?: string;
  line?: number;
  status?: 'success' | 'warning' | 'error' | 'info';
}

export interface NetworkContext {
  method?: string;
  url?: string;
  path?: string;
  route?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  responseBody?: unknown;
  durationMs?: number;
  failed?: boolean;
}

export interface DatabaseContext {
  system?: 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'prisma' | 'typeorm' | 'generic';
  query?: string;
  operation?: string;
  tableOrCollection?: string;
  parameters?: unknown[];
  resultCount?: number;
  returnedNull?: boolean;
  executionTimeMs?: number;
  errorMessage?: string;
}

export interface FrameworkContext {
  name: 'node' | 'react' | 'vue' | 'angular' | 'vanilla';
  version?: string;
  component?: ComponentContext;
  routing?: {
    currentRoute?: string;
    params?: Record<string, unknown>;
  };
  details?: Record<string, unknown>;
}

export interface ComponentContext {
  name: string;
  file?: string;
  line?: number;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
  hooks?: Array<{
    index: number;
    name: string;
    value?: unknown;
    dependencies?: unknown[];
  }>;
  parentName?: string;
  renderPath?: string[];
  lifecyclePhase?: 'mount' | 'render' | 'update' | 'unmount' | 'error';
}

export interface DependencyContext {
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  matchedPackages?: string[];
}

export interface EnvironmentContext {
  nodeEnv?: string;
  variables?: Record<string, string>;
  argv?: string[];
  cwd?: string;
}

export interface DebugContext {
  id: string;
  timestamp: number;
  error: ErrorInfo;
  source: SourceLocation;
  stack: StackFrame[];
  runtime: RuntimeContext;
  executionPath: ExecutionStep[];
  timeline: TimelineEvent[];
  network?: NetworkContext;
  database?: DatabaseContext;
  framework?: FrameworkContext;
  dependency?: DependencyContext;
  environment?: EnvironmentContext;
}

export interface QuestionsAnswered {
  what: string;
  where: string;
  why: string;
  how: string;
}

export interface FixRecommendation {
  title: string;
  explanation: string;
  suggestedPatch?: string; // Unified diff format
  suggestedCode?: string;
  targetFile?: string;
  lineRange?: { start: number; end: number };
  confidence: number; // 0 to 100
  possibleSideEffects: string[];
  verificationGuidance: string;
}

export interface RootCauseReport {
  id: string;
  timestamp: number;
  severity: ErrorSeverity;
  headline: string;
  rootCause: string;
  evidence: string[];
  trigger?: string;
  affectedLocation: SourceLocation;
  executionPath: string[];
  timeline: TimelineEvent[];
  confidenceScore: number;
  questionsAnswered: QuestionsAnswered;
  suggestedFix: FixRecommendation;
  possibleSideEffects: string[];
  context: DebugContext;
  aiEnhanced?: boolean;
  aiExplanation?: string;
}

export interface RedactionConfig {
  keys?: string[];
  patterns?: RegExp[];
  replacement?: string;
  redactUrls?: boolean;
  redactEnv?: boolean;
}

export interface DebugAdapter {
  name: string;
  framework: 'node' | 'react' | 'vue' | 'angular' | 'vanilla';
  detect(): boolean;
  captureContext(error: unknown, extras?: Record<string, unknown>): Promise<DebugContext> | DebugContext;
  getComponentContext?(): ComponentContext | undefined;
  getRuntimeContext?(): RuntimeContext;
  dispose?(): void;
}

export interface WhatItBrokeConfig {
  projectRoot?: string;
  framework?: 'auto' | 'node' | 'react' | 'vue' | 'angular' | 'vanilla';
  adapters?: string[];
  redact?: string[];
  redactPatterns?: string[];
  sourcemaps?: boolean;
  maxTimelineEvents?: number;
  outputFormat?: 'cli' | 'json' | 'html';
  outputDirectory?: string;
  ai?: {
    enabled: boolean;
    provider: 'openai' | 'gemini' | 'anthropic' | 'custom' | 'mock';
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
}
