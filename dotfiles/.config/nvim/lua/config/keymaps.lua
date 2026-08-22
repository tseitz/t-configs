-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

-- ────────────────────────────────────────────────────────────────
--  Shared with VS Code and Cursor.
--  The matching half lives in ../../../editors/settings.json, under "vim.".
--  Change one, change the other.
--
--  Not repeated here, because LazyVim already gives us the same behaviour:
--    - leader is space          (VS Code: "vim.leader": " ")
--    - y and p use the system clipboard, via clipboard = "unnamedplus"
--      (VS Code: "vim.useSystemClipboard": true)
-- ────────────────────────────────────────────────────────────────

-- Move the selected lines up and down.
-- This replaces visual-mode J, which normally joins lines. That is on purpose:
-- the same two keys do the same thing in VS Code. LazyVim's <A-j> and <A-k>
-- still work as well, so nothing is lost.
vim.keymap.set("v", "J", ":m '>+1<cr>gv=gv", { desc = "Move selection down" })
vim.keymap.set("v", "K", ":m '<-2<cr>gv=gv", { desc = "Move selection up" })
