/**
 * WhatItBroke - Angular Dependency Injection & Runtime Diagnostic Analyzer
 */

export interface DIAnalysisResult {
  isDIError: boolean;
  type: 'missing_provider' | 'circular_dependency' | 'expression_changed' | 'rxjs' | 'unknown';
  token?: string;
  injectorPath?: string[];
  explanation: string;
  advice: string;
}

export class DIAnalyzer {
  public static analyze(error: Error | { message: string }): DIAnalysisResult {
    const msg = error.message || '';

    // 1. NullInjectorError: No provider for Token!
    if (msg.includes('NullInjectorError') || msg.includes('NG0201')) {
      const match = msg.match(/No provider for ([^!]+)!/);
      const token = match ? match[1].trim() : 'UnknownToken';

      // Try parsing injector hierarchy e.g. AppModule[A -> B -> C]
      const hierarchyMatch = msg.match(/\[([A-Za-z0-9_ \->]+)\]/);
      const injectorPath = hierarchyMatch
        ? hierarchyMatch[1].split('->').map((s) => s.trim())
        : undefined;

      return {
        isDIError: true,
        type: 'missing_provider',
        token,
        injectorPath,
        explanation: `Angular Injector could not locate a provider for '${token}'.`,
        advice: `Ensure '${token}' is decorated with @Injectable({ providedIn: 'root' }) or added to providers: [${token}] in the NgModule or standalone component.`,
      };
    }

    // 2. Circular Dependency (NG0200)
    if (msg.includes('NG0200') || msg.includes('Circular dependency')) {
      return {
        isDIError: true,
        type: 'circular_dependency',
        explanation: 'Angular detected a circular dependency between two or more injected services.',
        advice: 'Refactor the circular relationship using a mediator service or inject via Injector.get() / forwardRef().',
      };
    }

    // 3. ExpressionChangedAfterItHasBeenCheckedError (NG0100)
    if (msg.includes('NG0100') || msg.includes('ExpressionChangedAfterItHasBeenCheckedError')) {
      return {
        isDIError: true,
        type: 'expression_changed',
        explanation: 'A component property was mutated after Angular change detection finished its verification pass.',
        advice: 'Move the mutation into ngOnInit, ChangeDetectorRef.detectChanges(), or defer with Promise.resolve().then() / queueMicrotask().',
      };
    }

    // 4. RxJS Stream Failure
    if (msg.includes('RxJS') || msg.includes('Observable') || msg.includes('EmptyError')) {
      return {
        isDIError: true,
        type: 'rxjs',
        explanation: 'An RxJS observable stream encountered an uncaught error or completed without emitting required values.',
        advice: 'Add catchError(() => of(fallback)) or check the pipeline subscription.',
      };
    }

    return {
      isDIError: false,
      type: 'unknown',
      explanation: msg,
      advice: '',
    };
  }
}
