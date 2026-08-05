# AGENTS.md

Project-level behavioral and tooling guidelines.

## Skills Index

| Skill | Topic |
| --- | --- |
| `brainstorming` | Design & planning: explore intent, constraints, propose approaches, get approval |
| `core-asset-usage` | Runtime config: Asset access patterns, PO/NonPO placement, UtilsHelper static usage |
| `core-browser-automation` | Playwright: BrowserSession, BrowserPage, navigation, interaction, waits, iframe |
| `core-extensions` | Helpers: StringExtensions, NumberExtensions, EnumExtensions, XmlExtensions |
| `logging` | Logging: LogEnter/LogLeave, Log/Warning/Error, [] formatting, | separator |
| `codebase-memory` | MCP graph: search_graph, trace_path, detect_changes, index_repository |

## Quick Reference

**Before any task:**

1. Invoke `brainstorming` skill — no exceptions

**Before editing code:**

1. Invoke `codebase-memory` skill → `search_graph` + `trace_path(direction="inbound")`
2. Read `logging` skill for any function you write or modify

**After code changes:**

1. `detect_changes()` → verify affected scope
2. `index_repository(mode="full")` → sync knowledge graph