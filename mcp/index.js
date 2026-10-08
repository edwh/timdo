#!/usr/bin/env node
// TimDo MCP server (stdio). Lists the timdo_* tools and runs each call through bin/timdo --json,
// so it acts as whoever the CLI is signed in as (bin/timdo login). Needs no other credentials.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'node:fs';
import { TIMDO_TOOLS, handleTimdoTool } from './src/timdo-tools.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const server = new Server({ name: 'timdo', version }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TIMDO_TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTimdoTool(name, args || {});
    if (result !== null) return result;
    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error executing ${name}: ${err.message || String(err)}` }],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TimDo MCP server running on stdio');
}

run().catch((err) => {
  console.error('Fatal error running TimDo MCP server:', err);
  process.exit(1);
});
