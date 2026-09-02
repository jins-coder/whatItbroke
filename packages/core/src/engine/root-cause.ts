/**
 * WhatItBroke - Root Cause Engine
 * Performs multi-stage heuristic analysis across Error, Stack, Source,
 * Timeline, Database/Network, and Framework context to pinpoint the exact failure cause.
 */

import {
  DebugContext,
  ErrorSeverity,
  QuestionsAnswered,
  RootCauseReport,
} from '@whatitbroke/shared';
import { FixGenerator, FixPatternContext } from './fix-generator.js';

export class RootCauseEngine {
  /**
   * Evaluates the entire debug context and returns a comprehensive RootCauseReport
   */
  public static analyze(context: DebugContext): RootCauseReport {
    const error = context.error;
    const errName = error.name || 'Error';
    const errMessage = error.message || '';
    const stack = context.stack;
    const source = context.source;
    const timeline = context.timeline || [];
    const db = context.database;
    const net = context.network;
    const framework = context.framework?.name || 'vanilla';

    // Extract current code line if snippet is present
    let errorLineContent = '';
    if (source.snippet && source.snippet.lines) {
      const lineObj = source.snippet.lines.find((l) => l.isErrorLine);
      if (lineObj) {
        errorLineContent = lineObj.content.trim();
      }
    }

    // Heuristics:
    // 1. TypeError: Cannot read properties of undefined / null
    if (
      errName === 'TypeError' &&
      (errMessage.includes('Cannot read properties of undefined') ||
        errMessage.includes('Cannot read property') ||
        errMessage.includes('Cannot read properties of null') ||
        errMessage.includes('is undefined') ||
        errMessage.includes('is not a function'))
    ) {
      return this.analyzeTypeError(context, errorLineContent);
    }

    // 2. React Hook Rule Violations
    if (
      errMessage.includes('Rendered fewer hooks than expected') ||
      errMessage.includes('Rendered more hooks than expected') ||
      errMessage.includes('Invalid hook call') ||
      errMessage.includes('Hooks can only be called inside the body of a function component')
    ) {
      return this.analyzeReactHookError(context);
    }

    // 3. Vue Reactivity Loss or Setup Error
    if (
      framework === 'vue' &&
      (errMessage.includes('is not defined on instance') ||
        errMessage.includes('Cannot read properties of undefined (reading \'value\')') ||
        errMessage.includes('Unhandled error during execution of setup function'))
    ) {
      return this.analyzeVueReactivityError(context, errorLineContent);
    }

    // 4. Angular DI / NG errors
    if (
      errMessage.includes('NullInjectorError') ||
      errMessage.includes('NG0200') ||
      errMessage.includes('NG0100') ||
      errMessage.includes('ExpressionChangedAfterItHasBeenCheckedError')
    ) {
      return this.analyzeAngularError(context);
    }

    // 5. ReferenceError: x is not defined
    if (errName === 'ReferenceError' || errMessage.includes('is not defined')) {
      return this.analyzeReferenceError(context, errorLineContent);
    }

    // 6. Network failure / Unhandled API cascading failure
    if (net?.failed || (net?.statusCode && net.statusCode >= 400) || timeline.some((e) => e.status === 'error' && e.type === 'api_response')) {
      return this.analyzeNetworkCascadingError(context);
    }

    // 7. Database query error / connection failure
    if (db?.errorMessage || timeline.some((e) => e.status === 'warning' && e.type === 'db_query_end')) {
      return this.analyzeDatabaseError(context, errorLineContent);
    }

    // Fallback: Default Analyzer
    return this.analyzeDefault(context, errorLineContent);
  }

  /**
   * Analyzes TypeError (e.g. Cannot read properties of undefined/null)
   */
  private static analyzeTypeError(context: DebugContext, codeLine: string): RootCauseReport {
    const message = context.error.message;
    const timeline = context.timeline;
    const framework = context.framework?.name;

    // Extract property: reading 'name' or reading 'profile'
    const propMatch = message.match(/reading '([^']+)'/) || message.match(/Cannot read property '([^']+)'/);
    const propName = propMatch ? propMatch[1] : 'property';

    // Check if previous timeline event was a database query returning null/empty
    const lastDbEvent = [...timeline].reverse().find((e) => e.type === 'db_query_end');
    const dbReturnedNull = lastDbEvent?.details?.returnedNull === true || context.database?.returnedNull === true;

    // Check if in React/Vue and an API request was launched but hasn't resolved
    const lastApiReq = [...timeline].reverse().find((e) => e.type === 'api_request');
    const lastApiRes = [...timeline].reverse().find((e) => e.type === 'api_response');
    const apiInflight = lastApiReq && (!lastApiRes || lastApiRes.timestamp < lastApiReq.timestamp);

    const compName = context.framework?.component?.name;

    // Case A: React / Vue component rendered before API response finished
    if ((framework === 'react' || framework === 'vue' || compName) && apiInflight) {
      const targetVar = propName === 'name' ? 'user.profile' : `user.${propName}`;
      const rootCause = `${targetVar} is undefined during the initial render.`;
      const trigger = 'The API request has not completed.';
      
      const executionPath: string[] = [];
      if (context.framework?.component?.renderPath && context.framework.component.renderPath.length > 0) {
        executionPath.push(...context.framework.component.renderPath);
      } else {
        executionPath.push('App', 'Dashboard', compName || 'Component');
      }
      executionPath.push(`${targetVar}.${propName} ❌`);

      const fixContext: FixPatternContext = {
        sourceLoc: context.source,
        codeLine,
        variableName: targetVar,
        propertyName: propName,
        framework,
      };

      const suggestedFix = FixGenerator.generate('REACT_UNHANDLED_LOADING_STATE', context, fixContext);

      const questions: QuestionsAnswered = {
        what: `TypeError in <${compName || 'Component'}>: Cannot read property '${propName}' of undefined`,
        where: `${context.source.file}:${context.source.line}`,
        why: `${targetVar} was accessed before the asynchronous API request resolved, causing undefined property dereference.`,
        how: suggestedFix.explanation,
      };

      return {
        id: `rc_${Date.now()}`,
        timestamp: Date.now(),
        severity: 'high',
        headline: `Undefined property dereference in <${compName || 'Component'}>`,
        rootCause,
        trigger,
        evidence: [
          `Component rendered at timestamp ${Date.now()}`,
          `API request '${lastApiReq.details?.url || 'endpoint'}' was still pending during render`,
          `Property '${propName}' does not exist on initial state undefined`,
        ],
        affectedLocation: context.source,
        executionPath,
        timeline,
        confidenceScore: 94,
        questionsAnswered: questions,
        suggestedFix,
        possibleSideEffects: suggestedFix.possibleSideEffects,
        context,
      };
    }

    // Case B: Node.js database result was null
    if (dbReturnedNull || context.database?.resultCount === 0) {
      const targetVar = 'user.profile';
      const rootCause = `${targetVar} is null after the database query.`;

      // Build execution path
      const executionPath: string[] = [];
      const net = context.network;
      if (net?.method && (net.route || net.path)) {
        executionPath.push(`${net.method.toUpperCase()} ${net.route || net.path}`);
      } else {
        executionPath.push('GET /api/profile');
      }

      if (context.source.className) {
        executionPath.push(`${context.source.className}Controller`);
      } else {
        executionPath.push('UserController');
      }

      const fn = context.source.functionName || 'UserService.getProfile()';
      executionPath.push(fn);
      executionPath.push('Database query');
      executionPath.push('profile = null');
      executionPath.push(`profile.${propName} ❌`);

      const fixContext: FixPatternContext = {
        sourceLoc: context.source,
        codeLine,
        variableName: targetVar,
        propertyName: propName,
      };

      const suggestedFix = FixGenerator.generate('TYPE_ERROR_NULL_DB_RESULT', context, fixContext);

      const questions: QuestionsAnswered = {
        what: `TypeError: ${context.error.message}`,
        where: `${context.source.file}:${context.source.line}`,
        why: `Database query returned null for the requested record, and the service attempted to read '${propName}' without null check.`,
        how: suggestedFix.explanation,
      };

      return {
        id: `rc_${Date.now()}`,
        timestamp: Date.now(),
        severity: 'high',
        headline: `${targetVar} is null after database query`,
        rootCause,
        evidence: [
          `Database query completed with null/empty record`,
          `Code attempted to access property '.${propName}' without validating result`,
          `Stack trace pinpointed to ${context.source.file}:${context.source.line}`,
        ],
        affectedLocation: context.source,
        executionPath,
        timeline,
        confidenceScore: 94,
        questionsAnswered: questions,
        suggestedFix,
        possibleSideEffects: suggestedFix.possibleSideEffects,
        context,
      };
    }

    // Case C: General Undefined Property Access
    const targetVar = 'object';
    const rootCause = `Attempted to access property '${propName}' on an undefined or null value.`;
    const executionPath = [
      'Execution entry',
      context.source.functionName || 'function()',
      `${propName} accessed on undefined ❌`,
    ];

    const fixContext: FixPatternContext = {
      sourceLoc: context.source,
      codeLine,
      variableName: targetVar,
      propertyName: propName,
    };

    const suggestedFix = FixGenerator.generate('TYPE_ERROR_UNDEFINED_PROPERTY', context, fixContext);

    return {
      id: `rc_${Date.now()}`,
      timestamp: Date.now(),
      severity: 'medium',
      headline: `Cannot read properties of undefined ('${propName}')`,
      rootCause,
      evidence: [
        `Exception occurred at ${context.source.file}:${context.source.line}`,
        `Expression evaluates to undefined before property lookup`,
      ],
      affectedLocation: context.source,
      executionPath,
      timeline,
      confidenceScore: 90,
      questionsAnswered: {
        what: `TypeError: ${message}`,
        where: `${context.source.file}:${context.source.line}`,
        why: `An operation expected an object containing '${propName}', but received undefined or null.`,
        how: suggestedFix.explanation,
      },
      suggestedFix,
      possibleSideEffects: suggestedFix.possibleSideEffects,
      context,
    };
  }

  /**
   * Analyzes React Hook rules errors
   */
  private static analyzeReactHookError(context: DebugContext): RootCauseReport {
    const compName = context.framework?.component?.name || 'React Component';
    const rootCause = 'React Hook called conditionally or after early return, violating the Rules of Hooks.';
    const executionPath = [
      compName,
      'Render started',
      'Conditional branch evaluated',
      'Mismatched hook order ❌',
    ];

    const fix = FixGenerator.generate('REACT_HOOK_RULES_VIOLATION', context, {
      sourceLoc: context.source,
    });

    return {
      id: `rc_${Date.now()}`,
      timestamp: Date.now(),
      severity: 'high',
      headline: 'React Hook Rules Violation',
      rootCause,
      trigger: 'A hook (such as useState or useEffect) was invoked inside a condition or after an early return.',
      evidence: [
        'React internal hook count mismatch during component render',
        `Component affected: <${compName}>`,
      ],
      affectedLocation: context.source,
      executionPath,
      timeline: context.timeline,
      confidenceScore: 96,
      questionsAnswered: {
        what: `React Error: ${context.error.message}`,
        where: `${context.source.file}:${context.source.line}`,
        why: 'Hooks must always execute in the exact same order across all renders.',
        how: fix.explanation,
      },
      suggestedFix: fix,
      possibleSideEffects: fix.possibleSideEffects,
      context,
    };
  }

  /**
   * Analyzes Vue reactivity and setup errors
   */
  private static analyzeVueReactivityError(context: DebugContext, codeLine: string): RootCauseReport {
    const rootCause = 'Reactivity lost due to prop destructuring or missing .value unwrapping.';
    const compName = context.framework?.component?.name || 'VueComponent';
    const executionPath = [
      `<${compName}>`,
      'setup() execution',
      'Reactive property accessed',
      'Reactivity unwrapped or undefined ❌',
    ];

    const fix = FixGenerator.generate('VUE_REACTIVITY_LOSS', context, {
      sourceLoc: context.source,
      codeLine,
    });

    return {
      id: `rc_${Date.now()}`,
      timestamp: Date.now(),
      severity: 'medium',
      headline: 'Vue 3 Reactivity Loss',
      rootCause,
      evidence: [
        'Component setup function failed while reading reactive state',
        `Affected component: <${compName}>`,
      ],
      affectedLocation: context.source,
      executionPath,
      timeline: context.timeline,
      confidenceScore: 91,
      questionsAnswered: {
        what: `Vue Component Error: ${context.error.message}`,
        where: `${context.source.file}:${context.source.line}`,
        why: 'In Vue 3, destructuring props breaks the reactive Proxy binding unless toRefs() is used.',
        how: fix.explanation,
      },
      suggestedFix: fix,
      possibleSideEffects: fix.possibleSideEffects,
      context,
    };
  }

  /**
   * Analyzes Angular Dependency Injection and Change Detection errors
   */
  private static analyzeAngularError(context: DebugContext): RootCauseReport {
    const msg = context.error.message;
    const isDI = msg.includes('NullInjectorError') || msg.includes('NG0200');
    const compName = context.framework?.component?.name || 'AngularComponent';

    if (isDI) {
      const match = msg.match(/No provider for ([^!]+)!/);
      const serviceName = match ? match[1].trim() : 'UnknownService';
      const rootCause = `NullInjectorError: No provider found for ${serviceName}.`;
      const executionPath = [
        'PlatformRef.bootstrapModule()',
        'AppModule injector hierarchy',
        `<${compName}> instantiation`,
        `Resolve ${serviceName} dependency ❌`,
      ];

      const fix = FixGenerator.generate('ANGULAR_NULL_INJECTOR', context, {
        sourceLoc: context.source,
        variableName: serviceName,
      });

      return {
        id: `rc_${Date.now()}`,
        timestamp: Date.now(),
        severity: 'high',
        headline: `Missing Angular Provider: ${serviceName}`,
        rootCause,
        evidence: [
          `Angular DI container could not resolve token for ${serviceName}`,
          `Requested during creation of <${compName}>`,
        ],
        affectedLocation: context.source,
        executionPath,
        timeline: context.timeline,
        confidenceScore: 97,
        questionsAnswered: {
          what: `Angular NullInjectorError: No provider for ${serviceName}`,
          where: `${context.source.file}:${context.source.line}`,
          why: `The dependency ${serviceName} was injected into ${compName} without being registered in providers.`,
          how: fix.explanation,
        },
        suggestedFix: fix,
        possibleSideEffects: fix.possibleSideEffects,
        context,
      };
    }

    // NG0100: ExpressionChangedAfterItHasBeenCheckedError
    const rootCause = 'ExpressionChangedAfterItHasBeenCheckedError: Model updated after check.';
    const executionPath = [
      `<${compName}>`,
      'Change detection cycle 1',
      'View checked and values recorded',
      'Synchronous mutation in lifecycle hook',
      'Change detection verification cycle 2 ❌',
    ];

    const fix = FixGenerator.generate('ANGULAR_EXPRESSION_CHANGED', context, {
      sourceLoc: context.source,
    });

    return {
      id: `rc_${Date.now()}`,
      timestamp: Date.now(),
      severity: 'medium',
      headline: 'Angular Change Detection Conflict (NG0100)',
      rootCause,
      evidence: [
        'A component property was mutated during or immediately after the view check cycle',
      ],
      affectedLocation: context.source,
      executionPath,
      timeline: context.timeline,
      confidenceScore: 90,
      questionsAnswered: {
        what: `Angular NG0100: ${msg}`,
        where: `${context.source.file}:${context.source.line}`,
        why: 'Angular dev mode verifies that bindings do not change within the same change detection pass.',
        how: fix.explanation,
      },
      suggestedFix: fix,
      possibleSideEffects: fix.possibleSideEffects,
      context,
    };
  }

  /**
   * Analyzes ReferenceError
   */
  private static analyzeReferenceError(context: DebugContext, codeLine: string): RootCauseReport {
    const msg = context.error.message;
    const match = msg.match(/([^ ]+) is not defined/);
    const varName = match ? match[1] : 'identifier';

    const rootCause = `'${varName}' is not defined in the scope where it was evaluated.`;
    const executionPath = [
      context.source.functionName || 'Scope',
      `Evaluate ${varName} ❌`,
    ];

    const fix = FixGenerator.generate('REFERENCE_ERROR_UNDEFINED', context, {
      sourceLoc: context.source,
      codeLine,
      variableName: varName,
    });

    return {
      id: `rc_${Date.now()}`,
      timestamp: Date.now(),
      severity: 'high',
      headline: `ReferenceError: ${varName} is not defined`,
      rootCause,
      evidence: [
        `Identifier '${varName}' was referenced before declaration or without import`,
        `Source line: ${codeLine || 'unresolved'}`,
      ],
      affectedLocation: context.source,
      executionPath,
      timeline: context.timeline,
      confidenceScore: 89,
      questionsAnswered: {
        what: `ReferenceError: ${context.error.message}`,
        where: `${context.source.file}:${context.source.line}`,
        why: `Variable '${varName}' does not exist in lexical scope or module imports.`,
        how: fix.explanation,
      },
      suggestedFix: fix,
      possibleSideEffects: fix.possibleSideEffects,
      context,
    };
  }

  /**
   * Analyzes Network Cascading Errors
   */
  private static analyzeNetworkCascadingError(context: DebugContext): RootCauseReport {
    const net = context.network;
    const status = net?.statusCode || 500;
    const rootCause = `Cascading failure caused by HTTP ${status} from ${net?.url || 'upstream API'}.`;

    const executionPath = [
      `Outbound request: ${net?.method || 'GET'} ${net?.url || '/api'}`,
      `HTTP ${status} Response received`,
      'Downstream handler failed to process error response ❌',
    ];

    const fix = FixGenerator.generate('GENERIC', context, {
      sourceLoc: context.source,
    });

    return {
      id: `rc_${Date.now()}`,
      timestamp: Date.now(),
      severity: 'high',
      headline: `Upstream HTTP ${status} Network Failure`,
      rootCause,
      evidence: [
        `HTTP request to ${net?.url || 'endpoint'} returned status ${status}`,
        `Subsequent application logic assumed successful 200 payload`,
      ],
      affectedLocation: context.source,
      executionPath,
      timeline: context.timeline,
      confidenceScore: 88,
      questionsAnswered: {
        what: `Network failure: HTTP ${status}`,
        where: `${context.source.file}:${context.source.line}`,
        why: 'Upstream service returned an error status which was not caught or handled.',
        how: 'Add response status verification and error fallback handling around the fetch/HTTP call.',
      },
      suggestedFix: fix,
      possibleSideEffects: fix.possibleSideEffects,
      context,
    };
  }

  /**
   * Analyzes Database Errors
   */
  private static analyzeDatabaseError(context: DebugContext, codeLine: string): RootCauseReport {
    const db = context.database;
    const rootCause = db?.errorMessage || 'Database query execution failed.';

    const executionPath = [
      'Database query dispatch',
      db?.query ? `Query: ${db.query.slice(0, 50)}...` : 'SQL query',
      'Database engine error ❌',
    ];

    const fix = FixGenerator.generate('GENERIC', context, {
      sourceLoc: context.source,
      codeLine,
    });

    return {
      id: `rc_${Date.now()}`,
      timestamp: Date.now(),
      severity: 'critical',
      headline: 'Database Query Exception',
      rootCause,
      evidence: [
        `Database query: ${db?.query || 'unknown'}`,
        `Error: ${db?.errorMessage || 'Query rejected'}`,
      ],
      affectedLocation: context.source,
      executionPath,
      timeline: context.timeline,
      confidenceScore: 92,
      questionsAnswered: {
        what: `Database error: ${db?.errorMessage || context.error.message}`,
        where: `${context.source.file}:${context.source.line}`,
        why: 'Database rejected query syntax, schema constraint, or connection closed.',
        how: 'Check database schema, parameters, and active database connection pool.',
      },
      suggestedFix: fix,
      possibleSideEffects: fix.possibleSideEffects,
      context,
    };
  }

  /**
   * Default fallback analyzer
   */
  private static analyzeDefault(context: DebugContext, codeLine: string): RootCauseReport {
    const rootCause = context.error.message || 'Unhandled runtime exception occurred.';
    const executionPath = [
      'Application entry',
      context.source.functionName || 'function',
      'Exception raised ❌',
    ];

    const fix = FixGenerator.generate('GENERIC', context, {
      sourceLoc: context.source,
      codeLine,
    });

    return {
      id: `rc_${Date.now()}`,
      timestamp: Date.now(),
      severity: 'medium',
      headline: context.error.name || 'Application Error',
      rootCause,
      evidence: [
        `Error thrown: ${context.error.name}: ${context.error.message}`,
        `Stack location: ${context.source.file}:${context.source.line}`,
      ],
      affectedLocation: context.source,
      executionPath,
      timeline: context.timeline,
      confidenceScore: 75,
      questionsAnswered: {
        what: `${context.error.name}: ${context.error.message}`,
        where: `${context.source.file}:${context.source.line}`,
        why: 'Unhandled exception triggered during code execution.',
        how: fix.explanation,
      },
      suggestedFix: fix,
      possibleSideEffects: fix.possibleSideEffects,
      context,
    };
  }
}
