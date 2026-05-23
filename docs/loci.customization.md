# LociTerm Server-Side Customization Guide

This document covers the three GMCP modules that allow a game server to customize the
LociTerm client's appearance and behavior: **Loci.Skin**, **Loci.Prefs**, and **Loci.Menu**.

The intended use case is enabling MUD operators to drive settings from the
server so that all players see a consistent, branded experience without needing to configure
anything themselves.

---

## How the Three Modules Fit Together

| Module | Controls | Persists to localStorage? |
|--------|----------|--------------------------|
| `Loci.Skin` | UI chrome colors, borders, shadows | No |
| `Loci.Prefs` | Any user preference (skin, menu positions, nerfbar, etc.) | No |
| `Loci.Menu` | Button grid and menubar content | No |

All three are temporary overrides. When the connection drops, each module's `goodbye()`
handler fires and restores the user's own saved settings automatically. On the next
connection to your game, your server pushes them again via GMCP. Settings are always
your game's settings **while the player is logged in**.

Send them early in the session — right after GMCP negotiation completes — and don't change
them mid-session unless you have a specific gameplay reason to do so.

---

## Module: Loci.Skin

**Declare support:** `"Loci.Skin 1"`

Replaces the CSS custom properties that control the UI chrome: panel and popup colors,
border styles, and whether nerfbar extra buttons are shown. Does not change the terminal
emulator's color theme (use `Loci.Prefs.Set` with `xtermoptions.theme` for that).

### Commands

#### Server → Client: `Loci.Skin.Set`

All fields are optional. Omitted fields keep their current value, so partial overrides work.

```json
{
    "coverColor":           "#7c1f3b",
    "paperColor":           "#d8d6c6",
    "altpaperColor":        "#ecebe4",
    "textColor":            "#443311",
    "linkColor":            "#AA2600",
    "visitedColor":         "#CC2600",
    "borderRadiusPanel":    "calc(var(--finger-size)/3.0)",
    "borderRadiusPopup":    "calc(var(--finger-size)/2.0)",
    "borderRadiusControl":  "calc(var(--finger-size)/4.0)",
    "borderWidth":          "1mm",
    "panelShadow":          "none",
    "nerfbarExtras":        "flex"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `coverColor` | CSS color | Primary accent: borders, button text, highlights |
| `paperColor` | CSS color | Main panel background |
| `altpaperColor` | CSS color | Input fields, alternating rows |
| `textColor` | CSS color | Body text inside panels |
| `linkColor` | CSS color | Hyperlinks in terminal output |
| `visitedColor` | CSS color | Visited hyperlinks |
| `borderRadiusPanel` | CSS length | Corner rounding on flat panels (e.g. `2px`, `0px`, `calc(var(--finger-size)/3.0)`) |
| `borderRadiusPopup` | CSS length | Corner rounding on popup menus and nerfbar |
| `borderRadiusControl` | CSS length | Corner rounding on buttons and inputs |
| `borderWidth` | CSS length | Border thickness on panels (e.g. `1px`, `1mm`) |
| `panelShadow` | CSS box-shadow | Drop shadow on panels; `none` disables it |
| `nerfbarExtras` | `"flex"` or `"none"` | `"none"` hides history ▲▼, wordstack 📋, and send ↵ buttons |

**Example — custom branded colors without using a named skin:**

```json
GMCP Loci.Skin.Set {
    "coverColor":          "#1a4a6e",
    "paperColor":          "#0d1f30",
    "altpaperColor":       "#162840",
    "textColor":           "#a8c8e8",
    "linkColor":           "#5ab0d8",
    "visitedColor":        "#4890b8",
    "borderRadiusPanel":   "0px",
    "borderRadiusPopup":   "0px",
    "borderRadiusControl": "0px",
    "borderWidth":         "1px",
    "panelShadow":         "0 0 6px #1a4a6e",
    "nerfbarExtras":       "none"
}
```

#### Server → Client: `Loci.Skin.Reset`

```json
{}
```

Restores the skin the user has saved in their preferences. No payload required.

#### Client → Server: `Loci.Skin.Get`

Sent by the client on init. The server does not need to reply immediately; it may send
`Loci.Skin.Set` at any time.

### Built-in Named Skins

LociTerm ships with five preset skins. You can apply one by name via `Loci.Prefs.Set`
rather than spelling out all the color values:

| Name | Description |
|------|-------------|
| `lociterm` | Default — warm parchment tones, rounded borders, 1mm border |
| `lociterm-dark` | Dark variant of the default skin |
| `minimal` | Light, flat UI — square corners, thin borders, no extra buttons |
| `minimal-dark` | Dark variant of minimal |
| `futuristic` | Dark background, green accent, no rounding, glow shadow |

---

## Module: Loci.Prefs

**Declare support:** `"Loci.Prefs 1"`

Applies any preference delta from the same tree used by `default_prefs.json`. This is the
most general-purpose customization hook — it covers everything from skin selection and menu
position to nerfbar behavior and terminal options.

The server-supplied values are applied without saving to localStorage. On disconnect, the
client re-applies its defaults and then the user's own saved prefs, fully undoing anything
the server set.

### Commands

#### Server → Client: `Loci.Prefs.Set`

The object structure mirrors `default_prefs.json`. Include only the keys you want to change.

```json
{
    "ui":           { ... },
    "menu":         { ... },
    "nerf":         { ... },
    "sfx":          { ... },
    "lociterm":     { ... },
    "xtermoptions": { ... }
}
```

---

### `ui` preferences

```json
"ui": {
    "skinname":       "lociterm",
    "fontSize":       "16px",
    "fingerSize":     "8mm",
    "background":     "#000000",
    "termScrollBar":  false,
    "terminalMargin": 0
}
```

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `skinname` | string | `"lociterm"` | Name of a built-in skin (see table above). Applies all skin CSS vars at once. |
| `fontSize` | CSS length | `"16px"` | Base font size for UI chrome elements |
| `fingerSize` | CSS length | `"8mm"` | Touch target size; scales buttons and nerfbar height |
| `background` | CSS color | `"#000000"` | Terminal background color behind the xterm canvas |
| `termScrollBar` | boolean | `false` | Show/hide terminal scrollbar |
| `terminalMargin` | number/CSS | `0` | Margin around the terminal canvas |

---

### `menu` preferences

```json
"menu": {
    "bgridAnchor":    "tr",
    "menusideAnchor": "br",
    "fade":           0.5,
    "themename":      "lociterm"
}
```

| Key | Type | Default | Valid values | Notes |
|-----|------|---------|-------------|-------|
| `bgridAnchor` | string | `"tr"` | `"tl"`, `"tr"`, `"bl"`, `"br"` | Corner where the button grid (menubox) is anchored. t=top, b=bottom, l=left, r=right. |
| `menusideAnchor` | string | `"br"` | `"tl"`, `"tr"`, `"bl"`, `"br"` | Corner where the slide-out menubar panel appears from. Should share an edge with `bgridAnchor`. |
| `fade` | number | `0.5` | `0.0` – `1.0` | Opacity of idle menu; `0` = fully transparent when not hovered |
| `themename` | string | `"lociterm"` | Name from `themes.json` | Terminal color theme (not UI chrome) |

**Typical corner pairings:**

```
Top-right buttons, right-side panel:  bgridAnchor: "tr",  menusideAnchor: "tr"
Top-left buttons, left-side panel:    bgridAnchor: "tl",  menusideAnchor: "tl"
Bottom-right buttons (default):       bgridAnchor: "tr",  menusideAnchor: "br"
Bottom-left buttons:                  bgridAnchor: "tl",  menusideAnchor: "bl"
```

---

### `nerf` preferences

```json
"nerf": {
    "enabled":             false,
    "chaining":            false,
    "localecho":           true,
    "keepCommandSelected": true
}
```

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `enabled` | boolean | `false` | Show (`true`) or hide (`false`) the line-mode nerfbar at the bottom of the screen. When `false`, input goes directly to the xterm terminal. |
| `chaining` | boolean | `false` | When `true`, unescaped `;` characters in nerfbar input are sent as newlines (command chaining). |
| `localecho` | boolean | `true` | Echo nerfbar input locally. |
| `keepCommandSelected` | boolean | `true` | After sending, select all text in nerfbar instead of clearing it. |

**Example — server-side toggle of the command line:**

```json
// Show nerfbar
GMCP Loci.Prefs.Set { "nerf": { "enabled": true } }

// Hide nerfbar (direct terminal input still works)
GMCP Loci.Prefs.Set { "nerf": { "enabled": false } }
```

---

### `sfx` preferences

```json
"sfx": {
    "terminalBell":     true,
    "mcmpPlayAudio":    true,
    "mcmpShowCaptions": false
}
```

| Key | Type | Notes |
|-----|------|-------|
| `terminalBell` | boolean | Enable terminal bell sound |
| `mcmpPlayAudio` | boolean | Enable Client.Media audio playback |
| `mcmpShowCaptions` | boolean | Show captions for audio events |

---

### `lociterm` preferences

```json
"lociterm": {
    "bsSendsDel":           true,
    "encoding":             "utf-8",
    "linksOpenImmediately": false
}
```

| Key | Type | Notes |
|-----|------|-------|
| `bsSendsDel` | boolean | Backspace key sends DEL (`0x7f`) instead of BS (`0x08`) |
| `encoding` | string | Terminal encoding: `"utf-8"` or `"latin1"` |
| `linksOpenImmediately` | boolean | Click a link to open immediately vs click-to-reveal first |

---

### `xtermoptions` preferences

These are passed directly to the xterm.js `terminal.options` object. Common useful keys:

```json
"xtermoptions": {
    "fontSize":        16,
    "fontFamily":      "LOFont,courier",
    "cursorBlink":     true,
    "cursorStyle":     "block",
    "scrollback":      1000,
    "theme": {
        "foreground":   "#e4e4e4",
        "background":   "#000000",
        "cursor":       "#e4e4e4",
        "black":        "#000000",
        "red":          "#fd233e",
        "green":        "#1cbd30",
        "yellow":       "#b4a543",
        "blue":         "#7575ff",
        "magenta":      "#ea5685",
        "cyan":         "#28cdcd",
        "white":        "#e4e4e4",
        "brightBlack":  "#709080",
        "brightRed":    "#ff566e",
        "brightGreen":  "#5cff71",
        "brightYellow": "#ffffb4",
        "brightBlue":   "#4ea0e4",
        "brightMagenta":"#ff95db",
        "brightCyan":   "#87e4e4",
        "brightWhite":  "#ffffff"
    }
}
```

See the [xterm.js ITerminalOptions reference](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/)
for the full list of available keys.

---

#### Server → Client: `Loci.Prefs.Reset`

```json
{}
```

Re-applies client defaults and then the user's saved preferences, undoing everything the
server set. Called automatically on disconnect; the server can also send it explicitly.

#### Client → Server: `Loci.Prefs.Get`

Sent by the client on init. The server does not need to respond.

---

## Module: Loci.Menu

**Declare support:** `"Loci.Menu 1"`

See `docs/loci.menu.txt` for the complete protocol specification and JSON format reference.
See `client/src/menu/lo_menu.json` for a comprehensive real-world example.

The system menu button (⚙) is always present in the menubox. By default it opens
`sys_client`, which contains Login, Logout, Settings, and About entries. If you supply a
`menubar` item with `"id": "sys_client"` in your `Loci.Menu.Set` payload, it **replaces**
the default `sys_client` panel rather than appending a second one. This lets you restrict
what players can reach — for example, omit the Settings entry entirely from your
`sys_client` definition and players have no GUI path to client settings.

To limit what users can do with other menus, simply don't expose `sys_game_select` or
`sys_connect_direct` in any button or menubar item you define.

**System menus available for use in custom menubar items:**

| ID | Opens |
|----|-------|
| `sys_settings` | Full client settings panel |
| `sys_disconnect` | Reconnect / logout |
| `sys_hotkey` | Hotkey editor |
| `sys_wordstack` | Word clipboard |
| `sys_about` | About LociTerm |
| `sys_filters` | CRT visual filters |
| `sys_pronoun` | Pronoun settings |

**Blanking out menubar items:** Setting an item in the `item` array to `null` skips it
entirely. This lets you blank out specific entries in an otherwise-copied menu without
restructuring the whole array.

---

## GMCP-Only Deployment Example

For a game server that wants a consistent branded experience **while the player is logged in**:

> Settings pushed via GMCP are session-only — they reset when the connection closes.
> For branding that persists between sessions, use [Portal Configuration](#portal-configuration) instead.

```json
// Send right after GMCP negotiation completes.

// 1. Set layout and skin
GMCP Loci.Prefs.Set {
    "ui":   { "skinname": "minimal-dark" },
    "menu": { "bgridAnchor": "tl", "menusideAnchor": "tl", "fade": 0.3 },
    "nerf": { "enabled": true }
}

// 2. Set a custom menu.
//    "GAME" button opens menu_main.  The system ⚙ button is removed by including
//    "Client Settings" with no action — only the GAME button remains in the grid.
GMCP Loci.Menu.Set {
    "name":  "menu_mygame",
    "label": "My Game",
    "menubox": {
        "width": 1, "height": 1,
        "buttons": [
            { "name": "Client Settings" },
            { "name": "GAME", "text": "GAME", "menubar": "menu_main" }
        ]
    },
    "menubar": [
        {
            "id": "menu_main",
            "item": [
                { "label": "Reconnect", "open": "sys_disconnect" },
                { "label": "Settings",  "open": "sys_settings"  }
            ]
        }
    ]
}
```

**Notes on system menubox buttons:**

- The system ⚙ button has the internal name `"Client Settings"`.
- To **remove** it: include `{ "name": "Client Settings" }` with no action content in
  your buttons array — the slot is omitted from the grid.
- To **replace** it: include `{ "name": "Client Settings", "text": "⚙", "menubar": "my_panel" }`.
- To **keep** it and only change what it opens: include a `menubar` panel with
  `"id": "sys_client"` — the button stays but now opens your panel instead.

To restore everything explicitly (also happens automatically on disconnect):

```json
GMCP Loci.Prefs.Reset {}
GMCP Loci.Skin.Reset {}
GMCP Loci.Menu.Reset {}
```

---

## Portal Configuration

A portal config lets you provide deployment defaults for LociTerm without requiring GMCP
support or any per-session server push.  It is entirely optional — if no config file is
found, LociTerm behaves exactly as it always has.

### Priority and user agency

How portal config interacts with user-saved prefs depends on context:

| Context | Priority order (high → low) |
|---------|-----------------------------|
| Browser page | GMCP → portal → user's prior prefs → factory |
| Installed PWA | GMCP → user's saved prefs → portal → factory |

In a **browser context**, LociTerm is being served from an operator's deployment.  Portal
config is applied on top of (and persisted over) prior user prefs, making it the effective
default for that origin.  Users can still change any setting the deployment exposes, but
their changes sit below the portal baseline — the portal always re-applies on reload.

In a **standalone (installed PWA) context**, the app belongs to the user.  Portal defaults
are applied live but not persisted, and the user's saved prefs are restored on top.  Their
choices are respected.

### Config file location

| Situation | File |
|-----------|------|
| Default | `./portal.json` next to `index.html` |
| Multiple configs on one server | `?portal=myconfig.json` in the URL |

If `?portal=` is present but the fetch fails, `portal.json` is **not** tried as a
fallback — fix the filename or remove the parameter.

### Format

```json
{
    "prefs": { },
    "skin":  { },
    "menu":  { }
}
```

All three sections are optional.

- **`prefs`** — any `Loci.Prefs.Set`-compatible delta
- **`skin`** — any `Loci.Skin.Set`-compatible object; stored under `ui.skin` and layered
  on top of any named skin specified in `prefs.ui.skinname`
- **`menu`** — any `Loci.Menu.Set`-compatible object; registered as the `"portal"` theme
  so `Loci.Menu.Reset` re-applies it after each disconnect (browser mode only)

### Full example

```json
{
    "prefs": {
        "ui":   { "skinname": "minimal-dark" },
        "menu": { "bgridAnchor": "tl", "menusideAnchor": "tl", "fade": 0.3 },
        "nerf": { "enabled": true }
    },
    "skin": {
        "coverColor":    "#1a4a6e",
        "paperColor":    "#0d1f30",
        "nerfbarExtras": "none"
    },
    "menu": {
        "name":  "menu_mygame",
        "label": "My Game",
        "menubox": {
            "width": 1, "height": 1,
            "buttons": [
                { "name": "Client Settings" },
                { "name": "GAME", "text": "GAME", "menubar": "menu_main" }
            ]
        },
        "menubar": [
            {
                "id": "menu_main",
                "item": [
                    { "label": "Reconnect", "open": "sys_disconnect" },
                    { "label": "Settings",  "open": "sys_settings"  }
                ]
            }
        ]
    }
}
```

`{ "name": "Client Settings" }` removes the default ⚙ button; the `GAME` button opens
`menu_main`, which provides Reconnect and access to LociTerm Settings.

---

## Disconnect Behavior

When the WebSocket closes, each GMCP module automatically calls its own reset:

- `Loci.Skin` → restores the skin named in the `ui.skinname` preference
- `Loci.Prefs` → re-applies default prefs, then loads the user's saved delta from localStorage
- `Loci.Menu` → restores the user's saved menu theme choice

In a browser context where portal config was loaded, the portal delta is part of localStorage
and therefore survives the reset automatically.  The branding reappears without any server push.

In a PWA context, the user's own saved prefs are restored after reset; portal defaults
reappear on the next page load.

On the next connection, GMCP negotiates again and your server's `Set` commands layer on top.
