/**
 * WhatItBroke - AI Prompt Builder
 * Safely constructs prompts from sanitized DebugContext.
 */

import { DebugContext, redact } from '@whatitbroke/shared';

export class PromptBuilder {
  public static buildPrompt(context: DebugContext): string {
    const clean = redact(context);
    const err = clean.error;
    const loc = clean.source;

    let prompt = `You are WhatItBroke AI, an expert software debugger.
Analyze this application runtime failure and provide:
1. Concise root cause explanation
2. Why it broke in this specific execution sequence
3. Recommended code modification
4. Confidence level assessment (integer between -10 and +10 adjustment)

ERROR:
${err.name}: ${err.message}

LOCATION:
${loc.file}:${loc.line}${loc.column ? `:${loc.column}` : ''}
Function: ${loc.functionName || 'unknown'}

SOURCE SNIPPET:
${loc.snippet?.lines.map((l) => `${l.lineNumber}: ${l.content}`).join('\n') || 'Not available'}

FRAMEWORK:
${clean.framework?.name || 'vanilla'}

TIMELINE PRECEDING EXCEPTION:
${clean.timeline?.map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.type}: ${e.summary}`).join('\n') || 'None recorded'}

Provide your response in JSON format:
{
  "explanation": "...",
  "rootCauseRefinement": "...",
  "confidenceAdjustment": 5,
  "additionalFixes": ["..."]
}
`;

    return prompt;
  }
}
