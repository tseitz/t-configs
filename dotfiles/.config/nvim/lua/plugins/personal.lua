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

-- Plan docs from the pre-implementation-review skill. Both flags are needed, not one:
-- .claude/ is a dotfile AND the plans dir is gitignored, so either filter alone still
-- hides them. The picker's own <A-h>/<A-i> toggle the same two.
vim.keymap.set("n", "<leader>fp", function()
  local dir = vim.fn.getcwd() .. "/.claude/plans"
  if vim.fn.isdirectory(dir) == 0 then
    vim.notify("No .claude/plans in " .. vim.fn.getcwd(), vim.log.levels.WARN)
    return
  end
  Snacks.picker.files({ cwd = dir, hidden = true, ignored = true })
end, { desc = "Find plan" })

-- denols returns hover docs as markdown with ```ts fences. Without this they render as
-- plain text.
vim.g.markdown_fenced_languages = { "ts=typescript" }

return {
  {
    -- Eager on purpose. The LazyVim extra loads this on <leader>a* only, and until it
    -- loads there is no lock file in ~/.claude/ide/ -- so a Claude Code running in a
    -- separate terminal has nothing to find when you run /ide.
    "coder/claudecode.nvim",
    lazy = false,
  },
  {
    -- LazyVim's typescript extra only sets up vtsls, and vtsls refuses to attach when a
    -- deno.json is nearer than a package-manager lock file. Without denols a Deno repo
    -- gets no TypeScript diagnostics at all.
    --
    -- mason = false so the deno pinned by the repo's .mise.toml is the one that runs;
    -- Mason would install a second, unpinned copy.
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        denols = { mason = false },
      },
    },
  },
  {
    "nvim-neo-tree/neo-tree.nvim",
    opts = {
      filesystem = {
        filtered_items = {
          hide_dotfiles = false,
          hide_gitignored = false,
        },
      },
    },
  },
}
