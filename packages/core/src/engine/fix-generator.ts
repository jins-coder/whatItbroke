/**
 * WhatItBroke - Fix Recommendation Generator
 * Generates unified diffs, replacement code, side-effect analysis, and verification steps.
 */

import { DebugContext, FixRecommendation, SourceLocation } from '@whatitbroke/shared';

export interface FixPatternContext {
  targetExpr?: string;
  sourceLoc: SourceLocation;
  codeLine?: string;
  variableName?: string;
  propertyName?: string;
  isAsyncWaitNeeded?: boolean;
  framework?: string;
}

export class FixGenerator {
  /**
   * Generates a tailored fix recommendation based on error context and heuristic findings
   */
  public static generate(
    patternType: string,
    context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    switch (patternType) {
      case 'TYPE_ERROR_UNDEFINED_PROPERTY':
        return this.fixUndefinedPropertyAccess(context, extra);

      case 'TYPE_ERROR_NULL_DB_RESULT':
        return this.fixNullDbResult(context, extra);

      case 'REACT_UNHANDLED_LOADING_STATE':
        return this.fixReactUnhandledLoading(context, extra);

      case 'REACT_HOOK_RULES_VIOLATION':
        return this.fixReactHookRules(context, extra);

      case 'VUE_REACTIVITY_LOSS':
        return this.fixVueReactivityLoss(context, extra);

      case 'ANGULAR_NULL_INJECTOR':
        return this.fixAngularNullInjector(context, extra);

      case 'ANGULAR_EXPRESSION_CHANGED':
        return this.fixAngularExpressionChanged(context, extra);

      case 'REFERENCE_ERROR_UNDEFINED':
        return this.fixReferenceError(context, extra);

      default:
        return this.fixGeneric(context, extra);
    }
  }

  private static fixUndefinedPropertyAccess(
    _context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    const prop = extra.propertyName || 'property';
    const target = extra.variableName || 'object';
    const line = extra.sourceLoc.line;
    const originalLine = extra.codeLine?.trim() || `${target}.${prop}`;

    // Optional chaining replacement
    const patchedLine = originalLine.includes(`${target}.${prop}`)
      ? originalLine.replace(`${target}.${prop}`, `${target}?.${prop}`)
      : `${target}?.${prop}`;

    const patch = [
      `@@ -${line},1 +${line},1 @@`,
      `- ${originalLine}`,
      `+ ${patchedLine}`,
    ].join('\n');

    return {
      title: `Safely access \`${prop}\` using optional chaining or guard`,
      explanation: `Add optional chaining (\`?.\`) or verify that \`${target}\` is defined before accessing \`${prop}\`.`,
      suggestedPatch: patch,
      suggestedCode: patchedLine,
      targetFile: extra.sourceLoc.file,
      lineRange: { start: line, end: line },
      confidence: 93,
      possibleSideEffects: [
        `If downstream code expects \`${prop}\` to never be undefined, downstream type errors or empty UI states may occur.`,
        `Consider providing a fallback default value (e.g. \`${target}?.${prop} ?? 'Default'\`).`,
      ],
      verificationGuidance: `Run the function or render the component with \`${target} = undefined\` and assert it returns safely without throwing.`,
    };
  }

  private static fixNullDbResult(
    _context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    const line = extra.sourceLoc.line;
    const target = extra.variableName || 'user.profile';
    const originalLine = extra.codeLine?.trim() || `${target}.name`;

    const patch = [
      `@@ -${line},1 +${line},4 @@`,
      `+ if (!${target.split('.')[0]} || !${target}) {`,
      `+   throw new NotFoundError('${target.split('.')[0]} not found in database');`,
      `+ }`,
      `  ${originalLine}`,
    ].join('\n');

    return {
      title: 'Validate the database result before accessing properties',
      explanation: `Check whether the database query returned null or an empty record before reading properties on \`${target}\`.`,
      suggestedPatch: patch,
      suggestedCode: `if (!${target}) return null;`,
      targetFile: extra.sourceLoc.file,
      lineRange: { start: line, end: line },
      confidence: 94,
      possibleSideEffects: [
        'Callers of this service method will receive null or a NotFound error instead of an unhandled TypeError crash.',
      ],
      verificationGuidance: `Simulate a query with an unknown ID (returning null/empty) and verify the service handles the null result gracefully with HTTP 404 or a null return.`,
    };
  }

  private static fixReactUnhandledLoading(
    context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    const compName = context.framework?.component?.name || 'Component';
    const line = extra.sourceLoc.line;
    const target = extra.variableName || 'user.profile';

    const patch = [
      `@@ -${line},1 +${line},4 @@`,
      `+ if (!${target.split('.')[0]} || !${target}) {`,
      `+   return <LoadingSpinner />;`,
      `+ }`,
      `  return <div>{${target}.name}</div>;`,
    ].join('\n');

    return {
      title: 'Handle the loading / undefined state before accessing profile',
      explanation: `The component \`<${compName}>\` renders before the asynchronous data has finished loading. Provide a loading guard or default state.`,
      suggestedPatch: patch,
      suggestedCode: `if (isLoading || !${target}) return <Skeleton />;`,
      targetFile: extra.sourceLoc.file,
      lineRange: { start: line, end: line },
      confidence: 95,
      possibleSideEffects: [
        'A temporary loading indicator will briefly be shown while the network request is inflight.',
      ],
      verificationGuidance: `Render \`<${compName}>\` with an empty initial state or delayed Promise resolution; confirm that the component renders a fallback instead of crashing.`,
    };
  }

  private static fixReactHookRules(
    _context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    const line = extra.sourceLoc.line;
    return {
      title: 'Move hook call to top level of the component',
      explanation:
        'React Hooks cannot be called inside loops, conditions, or nested functions. Move all hook calls to the very top level before any early returns.',
      suggestedPatch: [
        `@@ -${line},1 +${line},1 @@`,
        `- if (condition) { const [val, setVal] = useState(); }`,
        `+ const [val, setVal] = useState(); // Call unconditionally at component top`,
      ].join('\n'),
      targetFile: extra.sourceLoc.file,
      lineRange: { start: line, end: line },
      confidence: 96,
      possibleSideEffects: [
        'State will be allocated on every render, which is expected by the React reconciliation engine.',
      ],
      verificationGuidance: 'Run ESLint with eslint-plugin-react-hooks to ensure rule compliance.',
    };
  }

  private static fixVueReactivityLoss(
    _context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    const propName = extra.propertyName || 'count';
    const line = extra.sourceLoc.line;
    return {
      title: 'Use toRefs() or toRef() when destructuring reactive props',
      explanation:
        `Destructuring props directly breaks Vue 3 reactivity. Use \`toRefs(props)\` to preserve reactive getters.`,
      suggestedPatch: [
        `@@ -${line},1 +${line},1 @@`,
        `- const { ${propName} } = props;`,
        `+ const { ${propName} } = toRefs(props);`,
      ].join('\n'),
      suggestedCode: `const { ${propName} } = toRefs(props);`,
      targetFile: extra.sourceLoc.file,
      lineRange: { start: line, end: line },
      confidence: 91,
      possibleSideEffects: [
        `Accessing \`${propName}\` inside \`<script setup>\` will now require \`.value\`, while template usage remains unchanged.`,
      ],
      verificationGuidance: 'Update the prop from the parent component and assert the child re-renders.',
    };
  }

  private static fixAngularNullInjector(
    _context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    const serviceName = extra.variableName || 'Service';
    const line = extra.sourceLoc.line;
    return {
      title: `Provide \`${serviceName}\` in root or component providers array`,
      explanation: `Angular injector could not locate \`${serviceName}\`. Add \`@Injectable({ providedIn: 'root' })\` to the service, or declare it in the component's \`providers: [${serviceName}]\`.`,
      suggestedPatch: [
        `@@ -1,3 +1,3 @@`,
        `- @Injectable()`,
        `+ @Injectable({ providedIn: 'root' })`,
        `  export class ${serviceName} {}`,
      ].join('\n'),
      suggestedCode: `@Injectable({ providedIn: 'root' })`,
      targetFile: extra.sourceLoc.file,
      lineRange: { start: line, end: line },
      confidence: 97,
      possibleSideEffects: [
        `The service becomes a singleton shared throughout the application injector hierarchy.`,
      ],
      verificationGuidance: `Run \`ng test\` or bootstrap the module and verify the component instantiates without NullInjectorError.`,
    };
  }

  private static fixAngularExpressionChanged(
    _context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    const line = extra.sourceLoc.line;
    return {
      title: 'Defer property update to ChangeDetectorRef or queueMicrotask',
      explanation:
        'Angular detected a binding mutation after change detection verified the view (NG0100). Move mutation to `ngOnInit` or wrap in `Promise.resolve().then(...)` / `queueMicrotask`.',
      suggestedPatch: [
        `@@ -${line},1 +${line},3 @@`,
        `- this.loading = false;`,
        `+ Promise.resolve().then(() => {`,
        `+   this.loading = false;`,
        `+ });`,
      ].join('\n'),
      targetFile: extra.sourceLoc.file,
      lineRange: { start: line, end: line },
      confidence: 89,
      possibleSideEffects: [
        'The binding will update in the subsequent microtask turn instead of the current tick.',
      ],
      verificationGuidance: 'Run in dev mode and ensure the NG0100 console error no longer appears on view check.',
    };
  }

  private static fixReferenceError(
    _context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    const varName = extra.variableName || 'variable';
    const line = extra.sourceLoc.line;
    return {
      title: `Declare or import \`${varName}\``,
      explanation: `\`${varName}\` was accessed but is not defined in the current scope. Check for missing import statements, typos, or variable hoisting issues.`,
      suggestedPatch: [
        `@@ -1,1 +1,2 @@`,
        `+ import { ${varName} } from './somewhere';`,
      ].join('\n'),
      targetFile: extra.sourceLoc.file,
      lineRange: { start: line, end: line },
      confidence: 88,
      possibleSideEffects: ['Ensure the imported module exports this identifier.'],
      verificationGuidance: 'Run TypeScript compiler (`tsc --noEmit`) to verify identifier resolution.',
    };
  }

  private static fixGeneric(
    _context: DebugContext,
    extra: FixPatternContext
  ): FixRecommendation {
    const line = extra.sourceLoc.line;
    return {
      title: 'Add defensive null/undefined checks around the failing expression',
      explanation:
        'Inspect the inputs to this function and add input validation or early return guards.',
      suggestedPatch: [
        `@@ -${line},1 +${line},3 @@`,
        `+ if (!value) return;`,
        `  // original operation`,
      ].join('\n'),
      targetFile: extra.sourceLoc.file,
      lineRange: { start: line, end: line },
      confidence: 70,
      possibleSideEffects: ['Review downstream callers for handling empty/null return values.'],
      verificationGuidance: 'Run unit tests targeting this specific code path.',
    };
  }
}
