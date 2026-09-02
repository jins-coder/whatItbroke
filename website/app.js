/**
 * WhatItBroke Interactive Playground & Showcase Script
 */

const SCENARIOS = {
  node: {
    framework: 'Node.js',
    file: 'src/services/user.service.ts:82',
    fn: 'UserService.getProfile()',
    code: `export class UserService {
  public static async getProfile(userId: string) {
    // 1. Query database for user record
    const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

    // 2. Fatal dereference: user.profile is null
    return user.profile.name; ❌
  }
}`,
    error: 'TypeError: Cannot read properties of undefined (reading \'name\')',
    cause: 'user.profile is null after the database query.',
    trigger: 'Database query for ID "usr_987" returned null / empty record.',
    executionPath: [
      'GET /api/profile',
      'UserController.getProfile()',
      'UserService.getProfile()',
      'Database query (12ms)',
      'profile = null',
      'profile.name ❌'
    ],
    timeline: [
      { time: '12:01:02.100', offset: '+0ms', icon: '•', text: 'Request started: GET /api/profile' },
      { time: '12:01:02.120', offset: '+20ms', icon: '💾', text: 'Database query: returned null (SELECT * FROM users...)' },
      { time: '12:01:02.135', offset: '+35ms', icon: '⚠', text: 'Undefined value detected: user.profile' },
      { time: '12:01:02.136', offset: '+36ms', icon: '❌', text: 'Exception: TypeError - Cannot read properties of undefined' }
    ],
    fix: 'Validate the database result before accessing properties on user.profile.',
    diffAdd: '+ if (!user || !user.profile) return null;',
    diffDel: '- return user.profile.name;',
    confidence: 94
  },

  react: {
    framework: 'React',
    file: 'src/components/UserProfile.tsx:42',
    fn: 'UserProfile Component',
    code: `export function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useUserQuery(userId);

  // Fatal: component renders before API query finishes
  return <div>{user.profile.name}</div>; ❌
}`,
    error: 'TypeError: Cannot read properties of undefined (reading \'name\')',
    cause: 'user.profile is undefined during the initial render.',
    trigger: 'The API request has not completed.',
    executionPath: [
      'App',
      'Dashboard',
      'UserProfile',
      'user.profile.name ❌'
    ],
    timeline: [
      { time: '12:01:02.100', offset: '+0ms', icon: '•', text: 'Navigation to /profile' },
      { time: '12:01:02.105', offset: '+5ms', icon: '🌐', text: 'API request: GET /api/user/me' },
      { time: '12:01:02.112', offset: '+12ms', icon: '⚡', text: 'Component rendered: <UserProfile />' },
      { time: '12:01:02.115', offset: '+15ms', icon: '❌', text: 'Exception: TypeError - Cannot read properties of undefined' }
    ],
    fix: 'Handle the loading / undefined state before accessing profile.',
    diffAdd: '+ if (isLoading || !user?.profile) return <Skeleton />;',
    diffDel: '- return <div>{user.profile.name}</div>;',
    confidence: 95
  },

  vue: {
    framework: 'Vue 3',
    file: 'src/components/ProductList.vue:14',
    fn: 'setup()',
    code: `<script setup lang="ts">
const props = defineProps<{ items: string[] }>();

// Fatal: Destructuring props breaks Vue 3 reactivity tracking
const { items } = props; ❌
</script>`,
    error: 'VueReactivityLoss: Destructuring reactive props breaks reactivity',
    cause: 'Reactivity lost due to prop destructuring without toRefs().',
    trigger: 'Parent component updated props but child retained stale unreactive reference.',
    executionPath: [
      '<App>',
      '<ProductList>',
      'setup() execution',
      'Prop destructuring ❌'
    ],
    timeline: [
      { time: '12:01:02.100', offset: '+0ms', icon: '⚡', text: 'Component mounted: <ProductList />' },
      { time: '12:01:02.130', offset: '+30ms', icon: '⚡', text: 'Parent state updated: items' },
      { time: '12:01:02.132', offset: '+32ms', icon: '⚠', text: 'Reactivity loss detected on prop: items' }
    ],
    fix: 'Use toRefs(props) or toRef(props, "items") when destructuring reactive props.',
    diffAdd: '+ const { items } = toRefs(props);',
    diffDel: '- const { items } = props;',
    confidence: 91
  },

  angular: {
    framework: 'Angular',
    file: 'src/app/dashboard.component.ts:12',
    fn: 'new DashboardComponent()',
    code: `@Component({ selector: 'app-dashboard' })
export class DashboardComponent {
  // Fatal: UserService is not registered in root or component providers
  constructor(private userService: UserService) {} ❌
}`,
    error: 'NullInjectorError: No provider for UserService!',
    cause: 'NullInjectorError: No provider found for UserService in injector tree.',
    trigger: 'DashboardComponent attempted to resolve UserService token during instantiation.',
    executionPath: [
      'PlatformRef.bootstrapModule()',
      'AppModule injector hierarchy',
      '<DashboardComponent> instantiation',
      'Resolve UserService token ❌'
    ],
    timeline: [
      { time: '12:01:02.100', offset: '+0ms', icon: '•', text: 'Bootstrap AppModule' },
      { time: '12:01:02.110', offset: '+10ms', icon: '⚡', text: 'Instantiate DashboardComponent' },
      { time: '12:01:02.114', offset: '+14ms', icon: '❌', text: 'NullInjectorError: No provider for UserService!' }
    ],
    fix: 'Add @Injectable({ providedIn: "root" }) or register in providers: [UserService].',
    diffAdd: '+ @Injectable({ providedIn: "root" })',
    diffDel: '- @Injectable()',
    confidence: 97
  }
};

let currentScenario = 'node';

function setScenario(key) {
  currentScenario = key;

  // Update tabs
  document.querySelectorAll('.framework-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.scenario === key);
  });

  const s = SCENARIOS[key];
  document.getElementById('code-display').textContent = s.code;
  document.getElementById('panel-file-label').textContent = s.file;

  runAnalysis();
}

function runAnalysis() {
  const s = SCENARIOS[currentScenario];
  const resultsDiv = document.getElementById('analysis-results');

  // Loading animation
  resultsDiv.innerHTML = `
    <div style="text-align: center; padding: 60px 0; color: #94a3b8;">
      <div style="font-size: 2rem; margin-bottom: 12px; animation: pulse 1s infinite;">🔍</div>
      <p style="font-weight: 600;">Reconstructing Execution Path & Timeline...</p>
      <p style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">Evaluating stack trace, database events, and AST context</p>
    </div>
  `;

  setTimeout(() => {
    resultsDiv.innerHTML = `
      <div class="card-broken">
        <div class="broken-header">
          <span class="broken-badge">1. WHAT BROKE</span>
          <span class="broken-error">${escapeHtml(s.error)}</span>
        </div>
        <div class="broken-location">📍 ${escapeHtml(s.file)} — ${escapeHtml(s.fn)}</div>
      </div>

      <div class="card-cause">
        <div class="cause-title">2. WHY IT BROKE (ROOT CAUSE)</div>
        <div class="cause-text">${escapeHtml(s.cause)}</div>
        <div style="font-size: 0.82rem; color: #cbd5e1; margin-top: 6px;"><strong>Trigger:</strong> ${escapeHtml(s.trigger)}</div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">Execution Path</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-family: var(--font-mono); font-size: 0.82rem;">
          ${s.executionPath.map((step, idx) => `
            <span style="background: #0d1527; padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06);">${escapeHtml(step)}</span>
            ${idx < s.executionPath.length - 1 ? '<span style="color: #64748b;">↓</span>' : ''}
          `).join('')}
        </div>
      </div>

      <div class="card-fix">
        <div class="fix-title">3. HOW TO FIX IT (RECOMMENDED PATCH)</div>
        <div class="fix-text">${escapeHtml(s.fix)}</div>
        <div class="diff-box">
          <span class="diff-del">${escapeHtml(s.diffDel)}</span>
          <span class="diff-add">${escapeHtml(s.diffAdd)}</span>
        </div>
      </div>

      <div class="meta-row">
        <div class="conf-pill">
          <span>✔ Confidence</span>
          <strong>${s.confidence}%</strong>
        </div>
        <button class="btn btn-secondary" onclick="toggleTimeline()" style="padding: 6px 14px; font-size: 0.82rem;">
          ⏱ Toggle Timeline (${s.timeline.length} events)
        </button>
      </div>

      <div id="timeline-container" style="display: none; margin-top: 16px; background: #070b14; border-radius: 8px; padding: 12px; border: 1px solid rgba(255,255,255,0.05); font-family: var(--font-mono); font-size: 0.78rem;">
        ${s.timeline.map(e => `
          <div style="display: flex; gap: 10px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
            <span style="color: #64748b; width: 85px;">${e.time}</span>
            <span style="color: #38bdf8; width: 45px;">${e.offset}</span>
            <span>${e.icon}</span>
            <span style="flex: 1;">${escapeHtml(e.text)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }, 350);
}

function toggleTimeline() {
  const container = document.getElementById('timeline-container');
  if (container) {
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
  }
}

function copyInstall(btn) {
  const text = 'npm install -g whatitbroke';
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✔ Copied!';
    setTimeout(() => {
      btn.textContent = 'Copy';
    }, 2000);
  });
}

function setTerminalTab(cmd) {
  document.querySelectorAll('.term-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  const body = document.getElementById('terminal-content');
  if (cmd === 'doctor') {
    body.innerHTML = `
<span style="color: #38bdf8;">$ whatitbroke doctor</span>
WhatItBroke Environment Doctor
Running health and diagnostics checks...

  <span style="color: #34d399;">✔</span> <strong>Node.js Version:</strong> v22.12.0 (Supported: >= 18.0.0)
  <span style="color: #34d399;">✔</span> <strong>Source Maps:</strong> Enabled in tsconfig.json (sourceMap: true)
  <span style="color: #34d399;">✔</span> <strong>Configuration:</strong> Valid whatitbroke.config.json detected
  <span style="color: #34d399;">✔</span> <strong>Privacy Engine:</strong> Active zero-leak redaction enabled (tokens, cookies, auth headers)

<span style="color: #34d399;">Doctor status: Healthy! WhatItBroke is ready to debug.</span>
`;
  } else if (cmd === 'verify') {
    body.innerHTML = `
<span style="color: #38bdf8;">$ whatitbroke verify src/services/user.service.ts</span>
WhatItBroke Fix Verification Pipeline
Testing proposed fix in an isolated sandbox...

  <span style="color: #34d399;">✔</span> <strong>1. Detect & Analyze:</strong> Target isolated: user.service.ts
  <span style="color: #34d399;">✔</span> <strong>2. Create Isolated Sandbox:</strong> Copied to temp sandbox
  <span style="color: #34d399;">✔</span> <strong>3. Apply Patch in Isolated Sandbox:</strong> Patch applied successfully
  <span style="color: #34d399;">✔</span> <strong>4. Run TypeScript Validation:</strong> Syntax verified with 0 errors
  <span style="color: #34d399;">✔</span> <strong>5. Verify Original Error Elimination:</strong> Runtime asserts null pointer prevented

<span style="color: #34d399; font-weight: bold;">✔ Fix Verification Passed!</span>
<span style="color: #64748b;">Original production files were not modified.</span>
`;
  } else {
    body.innerHTML = `
<span style="color: #38bdf8;">$ whatitbroke analyze</span>
WhatItBroke
────────────────────────────

<span style="color: #ef4444; font-weight: bold;">🔴 1 error detected</span>

<strong>1. user.service.ts:82</strong>
   <span style="color: #ef4444;">TypeError</span>

   <strong>Root cause:</strong>
   user.profile is null after the database query.

   <strong>Recommended Fix:</strong>
   Validate the database result before accessing profile.name.

   <strong>Confidence:</strong> <span style="color: #34d399;">94%</span>
`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
  setScenario('node');
});
