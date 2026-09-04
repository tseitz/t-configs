-- Keep only your personal keybinding overrides here. Add new bindings or
-- unbind defaults before replacing them.

-- See current bindings and descriptions:
--   omarchy menu keybindings --print

-- To disable every Omarchy default binding, set this in
-- ~/.config/hypr/hyprland.lua before require("default.hypr.omarchy"), then add
-- only the bindings you want below:
--   omarchy_default_bindings = false

-- To disable all preinstalled app/webapp bindings, set:
--   omarchy_preinstalled_bindings = false

-- Add a new binding.
-- o.bind("SUPER + SHIFT + R", "SSH", "alacritty -e ssh your-server")

-- Change an existing binding by unbinding it first, then binding the key again.
-- This example changes SUPER+SPACE from the launcher to the Omarchy root menu.
-- hl.unbind("SUPER + SPACE")
-- o.bind("SUPER + SPACE", "Omarchy menu", "omarchy-menu toggle root")

-- Disable a default binding without replacing it.
-- hl.unbind("SUPER + SHIFT + B")

-- SUPER+T was Omarchy's float/tile toggle. It is kept below for non-browsers.
hl.unbind("SUPER + T")

-- Copied from default/hypr/bindings/clipboard.lua. The down/up split works
-- around Hyprland send_shortcut leaving synthetic key state stuck/repeating.
-- https://github.com/hyprwm/Hyprland/discussions/14099
local function send_shortcut_once(mods, key)
  return function()
    hl.dispatch(hl.dsp.send_key_state({ mods = mods, key = key, state = "down" }))

    hl.timer(function()
      hl.dispatch(hl.dsp.send_key_state({ mods = mods, key = key, state = "up" }))
    end, { timeout = 50, type = "oneshot" })
  end
end

local function active_window_has_tag(name)
  local window = hl.get_active_window()
  if not window then
    return false
  end

  for _, tag in ipairs(window.tags or {}) do
    if tag:gsub("%*$", "") == name then
      return true
    end
  end

  return false
end

o.bind("SUPER + T", "New browser tab / toggle float", function()
  if active_window_has_tag("chromium-based-browser") or active_window_has_tag("firefox-based-browser") then
    send_shortcut_once("CTRL", "T")()
  else
    hl.dispatch(hl.dsp.window.float({ action = "toggle" }))
  end
end)

local function active_window_class_is(class_name)
  local window = hl.get_active_window()
  return window ~= nil and window.class == class_name
end

hl.unbind("SUPER + L")

o.bind("SUPER + L", "Toggle list item (Obsidian) / toggle workspace layout", function()
  if active_window_class_is("md.obsidian.Obsidian") then
    send_shortcut_once("CTRL", "L")()
  else
    hl.dispatch(hl.dsp.exec_cmd("omarchy-hyprland-workspace-layout-toggle"))
  end
end)

o.bind("SUPER + SHIFT + T", "Reopen closed browser tab", function()
  if active_window_has_tag("chromium-based-browser") or active_window_has_tag("firefox-based-browser") then
    send_shortcut_once("CTRL SHIFT", "T")()
  end
end)

-- Logitech MX Keys examples:
-- o.bind("SUPER + SHIFT + S", nil, "omarchy-capture-screenshot")
-- o.bind("SUPER + H", nil, "voxtype record toggle")
-- o.bind("SUPER + PERIOD", nil, "omarchy-shell shell toggle omarchy.emojis")

o.bind("SUPER + SHIFT + I", "Mouse settings", "omarchy-shell io.github.tseitz.mouse-settings toggle")
