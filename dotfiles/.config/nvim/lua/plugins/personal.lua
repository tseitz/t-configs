-- Personal Neovim tweaks, shared across machines.
--
-- LazyVim imports every file in lua/plugins, so this one file is the whole
-- overlay. On macOS the repo's nvim config is symlinked and this comes with it.
-- On Omarchy only THIS file is symlinked into Omarchy's own config, so its
-- defaults and theme integration stay intact.
--
-- Keymaps live here rather than in lua/config/keymaps.lua because Omarchy owns
-- that file. Top-level code runs at import, which is early enough for keymaps.

-- Shared with VS Code and Cursor. The matching half is "vim.visualModeKeyBindings"
-- in ../../../editors/settings.json. Change one, change the other -- nothing in
-- either repo checks that they agree.
--
-- Not repeated here, because LazyVim already gives the same behaviour:
--   - leader is space         (VS Code: "vim.leader": " ")
--   - y and p use the system clipboard, via clipboard = "unnamedplus"
--     (VS Code: "vim.useSystemClipboard": true)

-- Move the selected lines up and down. This replaces visual-mode J, which
-- normally joins lines. That is on purpose: the same two keys do the same thing
-- in VS Code. LazyVim's <A-j> and <A-k> still work, so nothing is lost.
vim.keymap.set("v", "J", ":m '>+1<cr>gv=gv", { desc = "Move selection down" })
vim.keymap.set("v", "K", ":m '<-2<cr>gv=gv", { desc = "Move selection up" })

return {}
