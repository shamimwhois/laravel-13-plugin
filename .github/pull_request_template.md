## Summary

<!-- Concise summary of what this PR introduces or fixes. -->

## Key Changes

- [ ] Skills (`skills/*/SKILL.md`)
- [ ] Architectural Guides (`docs/architecture/*.md`)
- [ ] Always-On Rules (`rules/AGENTS.md`)
- [ ] Subagents (`agents/*.md`)
- [ ] Hooks / Static Scanner (`hooks.json`, `scripts/`)
- [ ] Manifest & Docs (`plugin.json`, `README.md`, `CHANGELOG.md`)

## Security & Quality Checklist

- [ ] All PHP examples include `declare(strict_types=1);` and explicit top-level imports (zero inline leading backslashes).
- [ ] `plugin.json` and `hooks.json` validate cleanly as strict JSON.
- [ ] Every skill has valid YAML frontmatter (`name`, `description`).
- [ ] Bundled static scanner (`laravel-security-scan.mjs`) and `PreToolUse` hook (`pre-write-guard.mjs`) smoke tests pass.
- [ ] CodeRabbit CLI review completed and all actionable findings resolved.
