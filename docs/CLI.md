# WhatItBroke CLI Reference

The `@whatitbroke/cli` binary provides commands to initialize, diagnose, analyze, report, and verify application debugging workflows.

---

## Commands

### `whatitbroke init`

Auto-detects framework dependencies in `package.json` and creates a `whatitbroke.config.json` configuration file.

```bash
whatitbroke init [--dry-run] [--force]
```

**Flags:**
- `--dry-run`: Prints the generated configuration to stdout without writing files.
- `--force`: Overwrites an existing `whatitbroke.config.json` file.

---

### `whatitbroke doctor`

Performs an environment health check, inspecting Node.js version, TypeScript sourcemaps configuration, config file syntax, and active privacy redaction.

```bash
whatitbroke doctor
```

---

### `whatitbroke analyze`

Analyzes an error log, stack trace, or target source file, generating a 4-question root-cause analysis report.

```bash
whatitbroke analyze [target] [--format=cli|json|html] [--output=report.html]
```

**Examples:**
```bash
# Analyze a crash log file
whatitbroke analyze crash.log

# Analyze a source file for null-pointer vulnerabilities
whatitbroke analyze src/services/user.service.ts

# Export interactive HTML report
whatitbroke analyze crash.log --format=html --output=whatitbroke-report.html
```

---

### `whatitbroke report`

Renders or converts the most recently recorded crash report.

```bash
whatitbroke report [--format=cli|json|html] [--output=output-file]
```

---

### `whatitbroke verify`

Validates a proposed fix in an isolated sandbox environment.

```bash
whatitbroke verify <target-file>
```

**Workflow:**
1. Clones target file into an ephemeral temporary directory.
2. Applies proposed patch in the sandbox.
3. Runs syntax and compilation checks.
4. Verifies original runtime exception is eliminated.
5. Cleans up sandbox without altering original production files.

---

### `whatitbroke config`

Inspects active configuration and sensitive key redaction rules.

```bash
whatitbroke config
```
