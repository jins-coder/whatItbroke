/**
 * WhatItBroke - Vue Overlay
 * Re-exports the universal ErrorOverlay for Vue 3 applications.
 */

import { ErrorOverlay } from '@whatitbroke/core';

export { ErrorOverlay, ErrorOverlay as VueErrorOverlay } from '@whatitbroke/core';
export type { OverlayOptions, CapturedWarning } from '@whatitbroke/core';
