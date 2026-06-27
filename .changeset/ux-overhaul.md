---
"dev-workflows": minor
---

UX overhaul of the interactive experience:

- Smart interactive menu that adapts to project state (shows Init + Exit when no `.dwf/` is found, full menu with a mode badge when configured).
- All commands reachable from the menu: added Watch, List (with sub-select), and Explain.
- Consistent preview cards and a confirmation step before writing in `init` and `add`.
- Clean back navigation: Esc returns to the previous step instead of exiting the process.
- `watch` Ctrl+C now returns to the menu instead of killing the program.
- Fixed `init` overwrite handling in non-TTY environments and added registry end-to-end tests.
