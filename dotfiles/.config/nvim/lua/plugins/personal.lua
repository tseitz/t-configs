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

-- nv in .zshrc-herdr, which also names the path, reaches this tab's nvim here. The first
-- nvim in a tab takes it; a file left by a crashed nvim is reclaimed.
local herdr_sock = vim.env.HERDR_NVIM_SOCK
if herdr_sock and herdr_sock ~= "" then
  local ok, chan = pcall(vim.fn.sockconnect, "pipe", herdr_sock)
  if ok and chan > 0 then
    vim.fn.chanclose(chan)
  else
    vim.fn.mkdir(vim.fs.dirname(herdr_sock), "p", tonumber("700", 8))
    os.remove(herdr_sock)
    vim.fn.serverstart(herdr_sock)
  end
end

return {
  {
    -- Eager on purpose. The LazyVim extra loads this on <leader>a* only, and until it
    -- loads there is no lock file in ~/.claude/ide/ -- so a Claude Code running in a
    -- separate terminal has nothing to find when you run /ide.
    "coder/claudecode.nvim",
    lazy = false,
  },
  {
    "sindrets/diffview.nvim",
    cmd = { "DiffviewOpen", "DiffviewFileHistory" },
  },
  {
    -- review-prs.js sets HERDR_REVIEW on PR review tabs: someone else's unread code. These
    -- servers run project JS (eslint/tailwind/oxlint config, a committed
    -- node_modules/typescript), so they stay off there. tsc stays on, but pinned to Mason's
    -- binary: its default root_dir runs <root>/node_modules/.bin/tsc --version to pick one.
    -- A function, not a table, so it runs after the extras have defined these servers.
    "neovim/nvim-lspconfig",
    opts = function(_, opts)
      if vim.env.HERDR_REVIEW ~= "1" then
        return
      end
      local lockfiles = { "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb" }
      opts.servers = vim.tbl_deep_extend("force", opts.servers or {}, {
        eslint = { enabled = false },
        tailwindcss = { enabled = false },
        oxlint = { enabled = false },
        vtsls = { settings = { vtsls = { autoUseWorkspaceTsdk = false } } },
        tsc = {
          cmd = { vim.fn.stdpath("data") .. "/mason/bin/tsc", "--lsp", "--stdio" },
          root_dir = function(bufnr, on_dir)
            if vim.fs.root(bufnr, { "deno.json", "deno.jsonc" }) then
              return
            end
            on_dir(vim.fs.root(bufnr, { lockfiles, ".git" }) or vim.fn.getcwd())
          end,
        },
      })
    end,
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
