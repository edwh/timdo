# TimDo MCP server

A small [MCP](https://modelcontextprotocol.io) server that lets Claude Code, or any other MCP client, work with your TimDo tasks, epics, life goals, workspaces and sharing.

It doesn't talk to the API itself. Each tool call runs `bin/timdo --json` from this repo, so the server acts as whoever the CLI is signed in as, with the same permissions. It needs no Google or other credentials to start.

See [docs/collaboration.md](../docs/collaboration.md) for how workspaces, roles and sharing work.

## Install

Node 18 or newer, plus `bash`, `curl` and `jq` for the CLI.

```bash
cd mcp && npm install
```

## Log in first

The server uses the CLI's login, so sign in once:

```bash
bin/timdo login     # stores your personal token in ~/.config/timdo/config
bin/timdo whoami    # check it is you
```

## Add it to Claude Code

```bash
claude mcp add timdo -- node "/absolute/path/to/timdo/mcp/index.js"
```

## Other MCP clients

Most clients take a JSON block like this:

```json
{
  "mcpServers": {
    "timdo": {
      "command": "node",
      "args": ["/absolute/path/to/timdo/mcp/index.js"]
    }
  }
}
```

Add an `"env": { ... }` object to set any of the variables below.

## Environment variables

| Variable | What it does |
| --- | --- |
| `TIMDO_BIN` | Path to the `timdo` CLI. Defaults to this repo's `bin/timdo`, then `timdo` on your `PATH`. |
| `TIMDO_API` | API base URL. Defaults to production. For a local API: `http://127.0.0.1:8788/api/v2`. |
| `TIMDO_TOKEN` | Your personal token, if you'd rather not keep it in the config file. |
| `TIMDO_CONFIG` | Config file to read. Defaults to `~/.config/timdo/config`. |

The server passes its environment straight to the CLI, so anything the CLI reads works here too.

## Tools

Every tool also takes an optional `asUser` (an email address, sent as `X-Timdo-User`). Only the account owner's secret can use it to act as someone else. With a personal token you can only name yourself, and the API refuses any other email with a 403.

Tasks and notes:
- `timdo_list_tasks`: list tasks by status, project, workspace, assignee, epic, goal, customer, tag or missing links.
- `timdo_get_task`: one task with its links, notes and recent activity.
- `timdo_add_task`: create a task, optionally assigned and linked to another.
- `timdo_update_task`: change status, details, project, epic or assignee.
- `timdo_delete_task`: soft-delete a task.
- `timdo_add_note`: add a dated note, signed with your name.
- `timdo_list_notes`: a task's notes, oldest first.
- `timdo_search_tasks`: full-text search across every workspace you can see.
- `timdo_merge_tasks`: fold one task into another and archive the source.
- `timdo_link_tasks` / `timdo_unlink_tasks`: add or remove a link between two tasks.
- `timdo_list_customers`: customers with open task counts.
- `timdo_audit`: tasks missing an epic, goal, project or reason, and epics with no tasks.

Epics and goals:
- `timdo_list_epics`, `timdo_get_epic`, `timdo_add_epic`, `timdo_update_epic`, `timdo_delete_epic`: manage epics and see their progress.
- `timdo_list_goals`: your life goals (private to you).

Workspaces and sharing:
- `timdo_whoami`: which account the tools act as, and which API.
- `timdo_list_workspaces`: your workspaces with your role in each.
- `timdo_get_workspace`: members, projects and pending invites for one workspace.
- `timdo_share_workspace`: share a workspace with someone by email.
- `timdo_update_member_role`: change a member's role.
- `timdo_remove_member`: take someone out of a workspace.
- `timdo_move_project`: move a project and its history to another workspace.
- `timdo_activity`: who did what, newest first.

The sharing tools (`timdo_share_workspace`, `timdo_update_member_role`, `timdo_remove_member`, `timdo_move_project`) act straight away with no confirmation step, and so do `timdo_merge_tasks` and the delete tools. Tell your assistant to check with you before it uses them.

## Tests

```bash
cd mcp && npm test
```

The tests don't touch the API. One starts the server over stdio and checks that the tools are listed.

## Licence

AGPL-3.0-or-later, the same as the rest of TimDo.
