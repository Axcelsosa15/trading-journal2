{
  "product": {
    "name": "Trading Journal (All Markets)",
    "design_personality": [
      "Apple-inspired premium",
      "futuristic-but-minimal",
      "glassmorphism surfaces",
      "data-dense without clutter",
      "calm, confident fintech"
    ],
    "north_star": "Luxury financial cockpit: fast scanning, precise inputs, and calm analytics (Robinhood x Linear x Apple Stocks)."
  },
  "typography": {
    "font_pairing": {
      "display": {
        "name": "Space Grotesk",
        "fallback": "Inter, ui-sans-serif, system-ui",
        "usage": "H1/H2, KPI numerals, section titles"
      },
      "body": {
        "name": "Inter",
        "fallback": "ui-sans-serif, system-ui",
        "usage": "tables, forms, helper text"
      },
      "mono": {
        "name": "IBM Plex Mono",
        "fallback": "ui-monospace, SFMono-Regular",
        "usage": "symbols, order IDs, prices, CSV preview"
      }
    },
    "scale_tailwind": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "section_title": "text-sm font-semibold tracking-tight",
      "kpi_value": "text-2xl sm:text-3xl font-semibold tabular-nums",
      "body": "text-sm md:text-base",
      "small": "text-xs text-muted-foreground"
    },
    "numeric_rules": {
      "use_tabular_nums": true,
      "format": {
        "currency": "$12,345.67",
        "percent": "12.3%",
        "rr": "2.4R"
      }
    }
  },
  "color_system": {
    "notes": [
      "No purple for AI/chat surfaces.",
      "Use semantic green/red for P&L but keep it elegant (slightly desaturated).",
      "Avoid gradients on content blocks; gradients only as subtle background accents (<20% viewport)."
    ],
    "tokens_hsl": {
      "light": {
        "background": "210 20% 98%",
        "foreground": "222 47% 11%",
        "card": "0 0% 100%",
        "card-foreground": "222 47% 11%",
        "popover": "0 0% 100%",
        "popover-foreground": "222 47% 11%",
        "primary": "210 90% 45%",
        "primary-foreground": "210 40% 98%",
        "secondary": "210 20% 96%",
        "secondary-foreground": "222 47% 11%",
        "muted": "210 20% 96%",
        "muted-foreground": "215 16% 40%",
        "accent": "190 85% 40%",
        "accent-foreground": "210 40% 98%",
        "border": "214 20% 90%",
        "input": "214 20% 90%",
        "ring": "210 90% 45%",
        "destructive": "0 72% 52%",
        "destructive-foreground": "210 40% 98%",
        "success": "152 55% 38%",
        "success-foreground": "210 40% 98%",
        "warning": "38 92% 50%",
        "warning-foreground": "222 47% 11%",
        "surface-glass": "0 0% 100%",
        "surface-glass-alpha": "0.72"
      },
      "dark": {
        "background": "222 30% 6%",
        "foreground": "210 40% 96%",
        "card": "222 28% 10%",
        "card-foreground": "210 40% 96%",
        "popover": "222 28% 10%",
        "popover-foreground": "210 40% 96%",
        "primary": "210 95% 62%",
        "primary-foreground": "222 47% 11%",
        "secondary": "222 22% 14%",
        "secondary-foreground": "210 40% 96%",
        "muted": "222 22% 14%",
        "muted-foreground": "215 18% 70%",
        "accent": "190 90% 45%",
        "accent-foreground": "222 47% 11%",
        "border": "222 18% 18%",
        "input": "222 18% 18%",
        "ring": "210 95% 62%",
        "destructive": "0 70% 58%",
        "destructive-foreground": "222 47% 11%",
        "success": "152 60% 48%",
        "success-foreground": "222 47% 11%",
        "warning": "38 92% 55%",
        "warning-foreground": "222 47% 11%",
        "surface-glass": "222 28% 10%",
        "surface-glass-alpha": "0.62"
      }
    },
    "trading_semantics": {
      "pnl_positive": {
        "solid": "hsl(152 55% 38%)",
        "soft_bg": "hsl(152 55% 38% / 0.12)",
        "badge": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      },
      "pnl_negative": {
        "solid": "hsl(0 72% 52%)",
        "soft_bg": "hsl(0 72% 52% / 0.12)",
        "badge": "bg-rose-500/15 text-rose-700 dark:text-rose-300"
      },
      "pnl_neutral": {
        "solid": "hsl(215 16% 40%)",
        "soft_bg": "hsl(215 16% 40% / 0.10)"
      },
      "risk": {
        "low": "hsl(152 55% 38%)",
        "medium": "hsl(38 92% 50%)",
        "high": "hsl(0 72% 52%)"
      }
    },
    "heatmap_palette": {
      "rule": "Use 5 steps each side + neutral. Never rely on color alone; show tooltip with exact P&L.",
      "positive_steps": [
        "hsl(152 55% 38% / 0.10)",
        "hsl(152 55% 38% / 0.18)",
        "hsl(152 55% 38% / 0.28)",
        "hsl(152 55% 38% / 0.40)",
        "hsl(152 55% 38% / 0.55)"
      ],
      "negative_steps": [
        "hsl(0 72% 52% / 0.10)",
        "hsl(0 72% 52% / 0.18)",
        "hsl(0 72% 52% / 0.28)",
        "hsl(0 72% 52% / 0.40)",
        "hsl(0 72% 52% / 0.55)"
      ],
      "neutral": "hsl(215 16% 40% / 0.10)"
    }
  },
  "design_tokens": {
    "radius": {
      "card": "rounded-2xl",
      "control": "rounded-xl",
      "chip": "rounded-full"
    },
    "shadow": {
      "card_light": "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)]",
      "card_dark": "shadow-[0_18px_50px_-28px_rgba(0,0,0,0.65)]",
      "focus_glow": "ring-2 ring-primary/30 ring-offset-0"
    },
    "spacing": {
      "page_padding": "px-4 sm:px-6 lg:px-10",
      "section_gap": "gap-4 sm:gap-6",
      "card_padding": "p-4 sm:p-5 lg:p-6",
      "dense_row": "py-2.5"
    },
    "glassmorphism": {
      "spec": {
        "backdrop_blur": "backdrop-blur-xl",
        "surface": "bg-background/70 dark:bg-background/40",
        "border": "border border-border/60",
        "highlight": "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-b before:from-white/10 before:to-transparent before:pointer-events-none",
        "noise": "Use a subtle noise overlay via CSS mask or background-image; keep opacity <= 0.06"
      },
      "do_not": [
        "Do not place dark text on transparent dark surfaces.",
        "Do not blur behind dense tables; keep tables on solid card backgrounds for readability."
      ]
    }
  },
  "layout": {
    "grid": {
      "desktop": "12-col grid; max-w-[1280px] for content; allow full-bleed background",
      "dashboard": {
        "row1": "KPI strip: 4 cards (col-span-3 each)",
        "row2": "Equity curve (col-span-7) + P&L calendar heatmap (col-span-5)",
        "row3": "Trades table (col-span-12)"
      },
      "mobile": "Single column; KPI cards become horizontal scroll (snap)"
    },
    "navigation": {
      "pattern": "Left sidebar on desktop (collapsible) + bottom nav on mobile (optional).",
      "components": [
        "navigation-menu.jsx",
        "sheet.jsx",
        "breadcrumb.jsx"
      ]
    }
  },
  "components": {
    "component_path": {
      "buttons": "/app/frontend/src/components/ui/button.jsx",
      "cards": "/app/frontend/src/components/ui/card.jsx",
      "inputs": "/app/frontend/src/components/ui/input.jsx",
      "textarea": "/app/frontend/src/components/ui/textarea.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "switch": "/app/frontend/src/components/ui/switch.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "drawer": "/app/frontend/src/components/ui/drawer.jsx",
      "sheet": "/app/frontend/src/components/ui/sheet.jsx",
      "dropdown": "/app/frontend/src/components/ui/dropdown-menu.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "sonner_toast": "/app/frontend/src/components/ui/sonner.jsx",
      "skeleton": "/app/frontend/src/components/ui/skeleton.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "resizable": "/app/frontend/src/components/ui/resizable.jsx",
      "command_palette": "/app/frontend/src/components/ui/command.jsx"
    },
    "buttons": {
      "style": "Luxury / Elegant",
      "variants": {
        "primary": "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85 rounded-xl shadow-sm",
        "secondary": "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl",
        "ghost": "hover:bg-accent/10 rounded-xl"
      },
      "motion": "hover: translateY(-1px) + subtle glow; active: scale(0.98). Avoid transition-all; use transition-colors + transition-shadow."
    },
    "forms": {
      "pattern": "Apple-like grouped fields: label + control + helper; use Form (react-hook-form) wrapper.",
      "focus": "Inputs get ring-primary/30 + subtle inner shadow.",
      "attachments": "Use drag/drop zone inside Card; show thumbnails in AspectRatio; open full image in Dialog."
    },
    "tables": {
      "pattern": "Sticky header, zebra hover, compact density toggle.",
      "performance": "Virtualize rows for 1000+ trades (react-window). Keep row height fixed.",
      "cells": {
        "symbol": "use mono font",
        "pnl": "right aligned; color via semantic badge + sign",
        "tags": "Badge chips; overflow into +N"
      }
    },
    "charts_recharts": {
      "equity_curve": {
        "style": "Thin line (2px), subtle area fill (<= 0.12 opacity), minimal gridlines.",
        "tooltip": "Glass tooltip card with date, equity, daily P&L, drawdown.",
        "drawdown": "Optional second area series in muted red/neutral with low opacity."
      },
      "kpi_sparklines": "Tiny line charts inside KPI cards; no axes; muted stroke.",
      "empty_state": "Skeleton first, then empty card with CTA (Import CSV / Add trade)."
    },
    "calendar_heatmap": {
      "implementation": "Use Calendar component for date selection + custom heatmap grid for P&L intensity.",
      "interaction": [
        "Hover cell -> Tooltip with P&L, trades count, win rate",
        "Click cell -> filters Trades table to that day",
        "Keyboard: arrow navigation + Enter to select"
      ]
    },
    "ai_insights": {
      "pattern": "Right-side resizable panel (Resizable) with chat-like messages + 'Run analysis' CTA.",
      "colors": "Use accent (teal/cyan) for AI highlights; no purple.",
      "components": [
        "resizable.jsx",
        "scroll-area.jsx",
        "textarea.jsx",
        "button.jsx",
        "badge.jsx"
      ]
    },
    "broker_connections": {
      "pattern": "Card grid with provider logo, status pill, last sync, connect button.",
      "states": [
        "Disconnected",
        "Connecting (spinner)",
        "Connected",
        "Error (Alert)"
      ]
    }
  },
  "motion": {
    "principles": [
      "Use motion to clarify hierarchy (enter/exit, expand/collapse, filter changes).",
      "Prefer opacity + translateY(6px) for entrances.",
      "Charts animate subtly; avoid bouncy easing in finance contexts."
    ],
    "timings": {
      "fast": "120ms",
      "base": "180ms",
      "slow": "260ms"
    },
    "easing": {
      "standard": "cubic-bezier(0.2, 0.8, 0.2, 1)",
      "emphasized": "cubic-bezier(0.16, 1, 0.3, 1)"
    },
    "framer_motion_usage": {
      "page": "AnimatePresence for route transitions (fade + slight slide)",
      "cards": "stagger children 40ms",
      "hover": "whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}"
    },
    "reduced_motion": "Respect prefers-reduced-motion: disable parallax and chart animations."
  },
  "accessibility": {
    "contrast": "WCAG AA minimum; ensure muted text still readable on glass surfaces.",
    "focus": "Visible focus ring on all interactive elements.",
    "color_independence": "P&L uses sign (+/-) and icon (arrow up/down) in addition to color.",
    "hit_targets": "Min 44px touch targets on mobile.",
    "keyboard": "All dialogs, sheets, dropdowns must be keyboard navigable (shadcn defaults)."
  },
  "page_blueprints": {
    "auth": {
      "layout": "Centered card on subtle background with orb accent; no full-screen gradients.",
      "components": ["card", "form", "input", "button", "separator"],
      "micro_interactions": "Focus glow on inputs; submit button press scale."
    },
    "dashboard": {
      "layout": "Sidebar + top bar; KPI row; equity + heatmap; recent trades table.",
      "primary_actions": ["Add Trade", "Import CSV", "Run AI Insight"],
      "data_density": "Provide density toggle (Comfortable/Compact) affecting table row padding."
    },
    "trades_list": {
      "layout": "Filters bar (chips + date range) above table; table in Card.",
      "filters": ["Market", "Symbol", "Strategy", "Tags", "Result", "Date range"],
      "bulk_actions": "Select rows -> export/delete/add tag"
    },
    "trade_detail": {
      "layout": "Two-column: left details + chart; right journal + screenshots; mobile uses tabs.",
      "components": ["tabs", "card", "badge", "dialog", "carousel"],
      "screenshots": "Thumbnail grid -> Dialog full view"
    },
    "new_trade": {
      "layout": "Stepper-like sections (Accordion/Collapsible): Basics, Risk, Execution, Journal, Attachments.",
      "validation": "Inline errors + summary toast via Sonner."
    },
    "strategies_tags": {
      "layout": "Table + side drawer for create/edit.",
      "components": ["table", "drawer", "form", "badge"]
    },
    "brokers": {
      "layout": "Provider cards + connection dialog; CSV import wizard in Dialog with preview table.",
      "components": ["card", "dialog", "table", "progress", "tabs"]
    },
    "ai_insights": {
      "layout": "Main analytics + right resizable insights panel.",
      "prompt_presets": "Buttons for 'Find mistakes', 'Best setups', 'Risk review', 'Weekly recap'."
    },
    "settings": {
      "layout": "Simple list sections; theme toggle; profile; security.",
      "theme": "Switch component; animate background subtly (no universal transitions)."
    }
  },
  "image_urls": {
    "background_orbs": [
      {
        "url": "https://images.pexels.com/photos/7135007/pexels-photo-7135007.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "usage": "Light mode auth/dashboard subtle orb backdrop (blurred, low opacity)"
      },
      {
        "url": "https://images.unsplash.com/photo-1557683316-973673baf926?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWJzdHJhY3QlMjBncmFkaWVudCUyMG1lc2glMjBiYWNrZ3JvdW5kJTIwc3VidGxlfGVufDB8fHxibHVlfDE3ODIwMjgzNDl8MA&ixlib=rb-4.1.0&q=85",
        "usage": "Dark mode background mesh behind layout (very subtle, <= 0.12 opacity)"
      }
    ],
    "notes": "Use images only as blurred decorative backgrounds; never behind dense text/table content."
  },
  "implementation_notes": {
    "css": {
      "where": ["/app/frontend/src/index.css"],
      "instructions": [
        "Replace default shadcn tokens with the provided HSL tokens for light/dark.",
        "Add utility classes for glass panels (e.g., .glass-card) using @layer components.",
        "Remove centered App-header styles from App.css; do not center the whole app container."
      ]
    },
    "theme_toggle": {
      "library": "next-themes",
      "pattern": "Top-right Switch + icon; persist preference; animate only colors/shadows (no transition-all).",
      "data_testid": "theme-toggle-switch"
    },
    "testing_attributes": {
      "rule": "All interactive and key informational elements MUST include data-testid.",
      "examples": [
        "data-testid=\"login-form-submit-button\"",
        "data-testid=\"dashboard-kpi-net-pnl\"",
        "data-testid=\"trades-table\"",
        "data-testid=\"trade-form-attach-screenshot\"",
        "data-testid=\"ai-insights-run-analysis-button\""
      ]
    },
    "recommended_small_utilities": {
      "cn": "Use existing cn() helper pattern from shadcn components.",
      "number_format": "Centralize formatting helpers for currency/percent/R-multiple."
    }
  },
  "instructions_to_main_agent": [
    "Implement a premium Apple-inspired glass UI: glass only for KPI cards/side panels; keep tables on solid cards.",
    "Update /app/frontend/src/index.css tokens to match the provided light/dark HSL palette; ensure contrast.",
    "Create reusable layout primitives: AppShell (sidebar/topbar), GlassCard, KPIStatCard, FilterBar, HeatmapGrid.",
    "Use Recharts for equity curve + sparklines; keep gridlines minimal and tooltips glassy.",
    "Use Framer Motion for subtle entrances and hover lift; respect prefers-reduced-motion.",
    "Ensure every button/input/link/table and key KPI text includes data-testid (kebab-case).",
    "Do not introduce new UI libraries; use existing shadcn components in /components/ui (JS files)."
  ],
  "general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
