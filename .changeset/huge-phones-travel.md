---
"dev-workflows": minor
---

### `devw add` — interactive registry flow

- `devw add` without arguments opens an interactive flow: browse categories, multi-select rules, confirm, and install in one session
- `devw add <category>/<rule>` installs a rule directly from the GitHub registry
- `devw add --list` shows all available rules from the registry
- Old block format (`devw add typescript-strict`) is detected and shows a migration error

### `devw remove` — pulled rules

- `devw remove <category>/<rule>` removes a pulled rule and updates config
- `devw remove` without arguments opens an interactive multi-select of installed rules

### Removed

- `devw pull` command (absorbed into `devw add`)
- Local blocks system (`blocks/registry`, `blocks/installer`)
