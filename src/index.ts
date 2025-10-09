#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { WebSearchTool } from "./tools/search-tool.js";
import { ContentFetchTool } from "./tools/fetch-tool.js";

// Create an MCP server
const server = new McpServer({
  name: 'mcp-websearch-server',
  version: '1.0.0'
});

// Parse command line arguments for debug mode
const args = process.argv.slice(2);
const debugMode = args.includes('--debug');

// Initialize tool instances with debug mode
const searchTool = new WebSearchTool(debugMode);
const fetchTool = new ContentFetchTool(debugMode);

// Register the search tool
server.registerTool(
  'search',
  {
    title: 'Web Search with Fallback',
    description: 'Intelligent web search using DuckDuckGo as primary search engine with Brave Search as fallback. Features: 1) Automatic query enhancement using preferred sites configuration for tech queries (GitHub, StackOverflow, MDN, etc.), 2) Built-in rate limiting protection with intelligent request spacing and header rotation, 3) Automatic fallback to Brave Search when DuckDuckGo is rate limited or blocked, 4) Rich results with extracted keywords and intelligent summaries, 5) Search provider identification in results, 6) Debug mode support for troubleshooting. Results include title, URL, keywords array, intelligent summary, and search provider used. Handles up to 50 results with optional date filtering.',
    inputSchema: {
      query: z.string().describe('Search query string - will be automatically enhanced with relevant site: operators if applicable'),
      maxResults: z.number().optional().default(10).describe('Maximum number of results to return (default: 10, max: 50)'),
      dateFilter: z.enum(['d', 'w', 'm', 'y']).optional().describe('Filter results by date: d=past day, w=past week, m=past month, y=past year'),
    }
  },
  async (args) => {
    try {
      const result = await searchTool.execute(args as any);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Register the fetch tool
server.registerTool(
  'fetch',
  {
    title: 'URL Content Fetcher',
    description: 'Fetch and extract content from a URL',
    inputSchema: {
      url: z.string().describe('URL to fetch content from'),
    }
  },
  async (args) => {
    try {
      const result = await fetchTool.execute(args as any);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const useStdio = args.includes('--stdio');
  const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000');

  if (useStdio) {
    // Use stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP DuckDuckGo server running on stdio");
    if (debugMode) console.error("Debug mode enabled");
  } else {
    // Use HTTP streaming transport (default)
    const app = express();
    app.use(express.json());

    app.post('/mcp', async (req, res) => {
      // Create a new transport for each request to prevent request ID collisions
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      });

      res.on('close', () => {
        transport.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    app.listen(port, () => {
      console.error(`MCP WebSearch server running on http://localhost:${port}/mcp`);
      console.error("Use --stdio flag to run in stdio mode");
      console.error(`Use --port=<number> to specify a different port (default: 3000)`);
      console.error("Use --debug flag to enable debug logging");
      if (debugMode) console.error("Debug mode enabled");
    }).on('error', error => {
      console.error('Server error:', error);
      process.exit(1);
    });
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});