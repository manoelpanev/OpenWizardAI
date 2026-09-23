<!--
Master index of OpenWizardAI prompt includes. Agents: scan this to discover what reference material exists, then either rely on the inlined content or fetch the pointer-only references on demand. Each include is self-contained and agent-dense.
-->

# OpenWizardAI Reference Index

Two assembly directives shape what reaches you:

- `{{INCLUDE:name}}` - fully inlined into the parent prompt before delivery. You already have the content.
- `{{REF:name}}` - replaced with the absolute on-disk path of the bundled `.md` (native separators for the host OS). Nothing else is emitted; the parent prompt supplies any surrounding prose. Read the file directly with your file tools. **Note:** the path serves bundled content - to honor user customizations from Settings → OpenWizardAI Prompts, fetch via `openwizardai-cli prompts get <name>` instead.

| Include                 | Covers                                                                                                                                                                                                                                                              | Pull when...                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `_interface-primitives` | Read / Write / Peek / Poke access model + **intent → action routing table** (recurring tasks → Cue, theme/preference asks → Settings, recall → history, etc.) and offline fallback rules                                                                            | explaining how the agent interacts with OpenWizardAI at a high level              |
| `_documentation-index`  | Curated table of external docs URLs (Cue, playbooks, CLI, SSH, worktrees, etc.)                                                                                                                                                                                     | the agent may need authoritative reference material to fetch                      |
| `_history-format`       | JSON schema of session history entries stored at `{{AGENT_HISTORY_PATH}}`                                                                                                                                                                                           | the agent needs to recall prior work                                              |
| `_autorun-playbooks`    | Auto Run / autorun / auto-run docs - a.k.a. **playbooks**, "play book", "auto run doc", "autorun doc": file naming, mandatory `- [ ]` checkbox task format, grouping rules, examples, Playbook Exchange                                                             | the user mentions any of those terms or asks you to author/modify automation docs |
| `_openwizardai-cli`     | `openwizardai-cli` orientation: intent → command-group map + behavioral guidance (settings flow, Encore gating, notify judgment, Auto Run). Exact subcommands/flags come from `openwizardai-cli --help` / `<cmd> --help` / `reference` (introspected, never drifts) | the agent needs to manipulate OpenWizardAI state, coordinate agents, or inspect   |
| `_openwizardai-cue`     | **OpenWizardAI Cue** (automation, subscriptions, triggers, watchers): event types, `.openwizardai/cue.yaml` schema, pipeline topologies, template variables, CLI hooks                                                                                              | the agent is building or debugging a Cue pipeline                                 |
| `_file-access-rules`    | Agent write restrictions: `{{AGENT_PATH}}` + `{{AUTORUN_FOLDER}}` carve-out, allowed / prohibited operations                                                                                                                                                        | enforcing boundaries for an executing agent                                       |
| `_file-access-wizard`   | Wizard-only write restrictions: writes limited to `{{AUTORUN_FOLDER}}`                                                                                                                                                                                              | a planning/wizard agent that must not modify project files                        |

**Fetch examples:**

```bash
openwizardai-cli prompts list                # discover everything
openwizardai-cli prompts get _openwizardai-cli    # full CLI reference
openwizardai-cli prompts get _openwizardai-cue    # Cue authoring guide
openwizardai-cli prompts get _autorun-playbooks --json
```

Edits made through **Settings → OpenWizardAI Prompts** are persisted in `userData/core-prompts-customizations.json` and survive app updates.
