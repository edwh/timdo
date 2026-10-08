# TimDo System Primer & Architectural Overview

## 1. Executive Summary & Purpose
**TimDo** is a high-velocity, personal productivity and cognitive operating system built for solo high-impact decision makers. Rooted in the philosophy of **"one-at-a-time extreme focus"**, it bridges strategic life direction (aims, core values, recurring rhythms) down to operational task execution across **Web (Next.js 15), Voice (Groq Whisper), CLI (`bin/timdo`), and Gmail MCP integration**.

The system treats productivity as a multi-timescale feedback loop:
- **Strategic Horizon (Years/Quarters):** Core Values, Long-term Aims, and Active Focuses.
- **Project Horizon (Weeks/Months):** Epics and Category Workstreams (e.g. *Solfit*, *Migrating Dragons*, *Caving Crew*, *Personal*).
- **Execution Horizon (Days/Hours):** Active Projects (`do`, `awaiting`, `delay`, `delegate`, `done`) with effort sizes (`*` to `*****`), dated updates, and Gmail thread bindings.
- **Physical Feedback Horizon (Real World):** Printable high-contrast monochrome vector posters (~A0/A1/A2 and multi-sheet 6× A4 tiled packages) providing tactile, screen-free situational awareness on home/office walls.

---

## 2. Core Architecture & Tech Stack

```
                        ┌─────────────────────────────────────────────────────────┐
                        │                       Clients                           │
                        │  ┌─────────────────┐ ┌───────────────┐ ┌──────────────┐ │
                        │  │ Next.js Web App │ │ Voice/Whisper │ │  bin/timdo   │ │
                        │  │ (Mantine UI 7)  │ │ (MediaRecord) │ │ (Bash / curl)│ │
                        │  └────────┬────────┘ └───────┬───────┘ └──────┬───────┘ │
                        └───────────┼──────────────────┼────────────────┼─────────┘
                                    │                  │                │
                                    │ Auth0 JWT        │ Groq Audio     │ X-Internal-Secret
                                    ▼                  ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Cloudflare Edge Infrastructure                        │
│                                                                                 │
│   ┌────────────────────────────────┐        ┌───────────────────────────────┐   │
│   │   Cloudflare Pages Frontend    │        │    Cloudflare Workers API     │   │
│   │   (@cloudflare/next-on-pages)  │───────>│         (Hono V4)             │   │
│   └────────────────────────────────┘        └───────────────┬───────────────┘   │
│                                                             │                   │
│                                                             ▼                   │
│                                             ┌───────────────────────────────┐   │
│                                             │    Cloudflare D1 Database     │   │
│                                             │   (SQLite / Drizzle ORM)      │   │
│                                             └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Technical Stack:
- **Frontend:** Next.js 15 (App Router), React 19, Mantine UI 7, `@tanstack/react-query`, Tabler Icons.
- **Edge Deployment:** `@cloudflare/next-on-pages` running on Cloudflare Pages (`timdo.tdobson.net`).
- **Backend API:** Cloudflare Workers running Hono v4, Drizzle ORM, Zod validation schemas (`timdo-v2-api.hello4807.workers.dev`).
- **Database:** Cloudflare D1 SQLite database (`timdo-v2-db`).
- **Authentication:**
  - Web UI: Auth0 JWT via NextAuth.js.
  - CLI & MCP Tooling: Secure machine-to-machine `X-Internal-Secret` header resolving directly to user context without browser redirects.
- **Integrations:**
  - **Groq Whisper:** Low-latency voice transcription.
  - **Gmail MCP Server:** Local stdio MCP (`gmail-local`) allowing direct inbox triage, thread reading, draft composition, and task linking.

---

## 3. Data Model & Hierarchy

The database model forms a continuous chain from high-level philosophy to granular execution:

```
[Goals: Aims / Values / Housekeeping]
                  │
                  ▼
          [Categories]
                  │
                  ▼
              [Epics] (Milestones & strategic initiatives)
                  │
                  ▼
             [Projects / Tasks]
                  │
         ┌────────┴────────┐
         ▼                 ▼
[ProjectUpdates]     [Gmail Threads]
(Dated progress)    (Source context)
```

### 3.1 Project / Task Fields (`Projects` table)
- `id`: UUID v4 (CLI displays 6–8 char prefixes).
- `project`: Primary title/action name. Redundant category prefixes (`Solfit:`, `Crew:`) are automatically cleaned.
- `reason`: Why this task matters (crucial for clarity and prioritizing).
- `status`:
  - `do` — Active, immediate focus items.
  - `awaiting` — Parked waiting on external events/people; requires `awaitUntil` return date.
  - `delay` — Parked backlogged tasks.
  - `delegate` — Assigned out to team members.
  - `done` — Completed milestone.
- `priority`: Numeric priority scale (1 to 10).
- `size`: Sizing/effort indicator (`*` to `*****`), rendered as challenge meters.
- `category`: Primary workstream (`Solfit`, `Crew`, `Personal`, `Migrating Dragons`, `Mavala`, `Xebit`).
- `epicId`: Optional foreign key binding to an active or completed Epic.
- `goalId`: Optional foreign key binding to a Strategic Goal/Aim.
- `notes`: Markdown/text notes and next immediate steps.
- `awaitUntil`: Date string (YYYY-MM-DD). The Cloudflare Worker cron (`*/5 * * * *`) automatically checks awaiting items and transitions them back to `do` when the return date arrives.
- `gmailThreadId`: Unique Gmail thread identifier for bidirectional navigation.

---

## 4. Poster Studio & Vector Printing Engine (`/poster`)

TimDo features an integrated **Poster Studio** designed for physical awareness via monochrome laser printing:

### 4.1 Wall of Done (6× A4 Tiled Master Banner)
- **Dimensions:** ~420mm × ~891mm (`viewBox="0 0 1587 3368"`).
- **Structure:**
  - Chronological flow: Oldest items at the top, latest achievements and momentum at the bottom.
  - **3 Horizontal Tiers** aligning with the physical 2×3 A4 paper grid.
  - **4 Thematic Columns:** Columns 1–3 contain Personal items; Column 4 contains Work/Club projects (`Solfit`, `Crew`, `Migrating Dragons`, etc.).
  - **Synchronized Refresher Breaks:** Horizontal headers align across all 4 columns simultaneously at sheet boundaries (`PERSONAL (CONT.) | SOLFIT (CONT.)`).
- **Laser Optimization:** Solid `#000000` text, lines, and micro-bar challenge meters with 0.4px rounded corners. No gray dithering or halftone patterns.
- **Tiled Multi-Sheet Engine:** Produces 6 individual A4 SVGs (`viewBox="0 0 793.7 1122.5"`) with corner crosshairs (`+ P1` to `+ P6`), crop guidelines, and overlap margins for easy wall assembly.

### 4.2 Active Tasks Readout / Worksheet (A2)
- **Dimensions:** 420mm × 594mm portrait (`viewBox="0 0 420 594"`).
- **Behavior:**
  - Pure active momentum: excludes `done` tasks to preserve paper space.
  - Grouped by Category (`SOLFIT`, `CREW`, etc.) with task counts.
  - **Auto-Balanced 2-Column Layout:** Dynamically distributes category cards across two columns for full-portfolio views.
  - **Expanded Single-Column View:** When filtered to 1–2 categories, expands into a spacious single-column view with full reasons and notes.
  - Visual status bullets: `● Do`, `⏳ Awt (return date)`, `⏸ Dly`.

### 4.3 Life Goals & Routines (A2)
- **Dimensions:** 420mm × 594mm portrait (`viewBox="0 0 420 594"`).
- **Content:**
  - **Top 3 Aims:** 118mm × 60mm cards with multi-line `<tspan>` wrapping. Long aims render completely without string clipping or ellipses.
  - **Focuses:** 4 wide focus slots with emojis and wrapped titles.
  - **Core Values:** 6 numbered principles with titles and wrapped descriptive sentences.
  - **Regular Tasks / Housekeeping:** 6 schedule boxes (Weekly, Monthly, Every Few Months, Daily Personal, Daily Shared, Child Care) with clean bulleted items.

### 4.4 Multi-Category Filtering
Poster Studio features a reactive filter toolbar:
- Filter chips: `All Categories`, `Solfit`, `Crew`, `Personal`, `Migrating Dragons`, `Mavala`, `Xebit`.
- Scopes both **Active Tasks Readout** and **Wall of Done** in real time.
- Dynamic download filenames (e.g. `timdo-active-tasks-Solfit-2026-09-15.svg`).

---

## 5. CLI & Automation Tooling (`bin/timdo`)

The TimDo CLI provides sub-second manipulation of the task ledger for terminals and AI agents:

```bash
# Task operations
bin/timdo list [all|do|delay|done|awaiting] [-p <category>]
bin/timdo add "Title" -r "Reason" --status do --priority 8 --size "***" -p Solfit
bin/timdo update <id> --done
bin/timdo update <id> --awaiting --await-until 2026-09-30
bin/timdo add-note <id> "Sent revised calculation sheet"
bin/timdo merge <source_id> <target_id> --yes

# Epics & Goals
bin/timdo epic list [-p <category>]
bin/timdo epic add "Acme Solar Rollout" -p Solfit
bin/timdo goal list

# Vector Poster Generation & Export
bin/timdo poster --type done --category Solfit --output ~/solfit_done.svg
bin/timdo poster --type active --category "Solfit,Migrating Dragons" --output ~/active.svg
bin/timdo poster --type goals --output ~/life_goals.svg
```

---

## 6. Daily Workflows & Inbox Triage Protocol

1. **Morning Triage:** Review Gmail inbox via MCP (`search_threads`), synthesize thread history against existing TimDo tasks, and triage one-at-a-time (reply, log update, or park with return date).
2. **Day Execution:** Work from `bin/timdo list do` or the board view (`/board`). Append dated notes via `bin/timdo add-note` as progress occurs.
3. **Weekly Review & Poster Print:**
   - Review `/poster` in the browser.
   - Filter by current focus categories or inspect the overall portfolio.
   - Print out an updated A2 Active Worksheet or 6× A4 Wall of Done onto the monochrome laser printer for physical review.
