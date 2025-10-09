#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express, { Request, Response } from 'express';
import https from 'https';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { WebSearchTool } from "./tools/search-tool.js";
import { ContentFetchTool } from "./tools/fetch-tool.js";
import { toolDescriptions, parameterDescriptions } from "./descriptions.js";
import cors from 'cors';

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
    description: toolDescriptions.search,
    inputSchema: {
      query: z.string().describe(parameterDescriptions.search.query),
      maxResults: z.number().optional().default(10).describe(parameterDescriptions.search.maxResults),
      dateFilter: z.enum(['d', 'w', 'm', 'y']).optional().describe(parameterDescriptions.search.dateFilter),
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
    description: toolDescriptions.fetch,
    inputSchema: {
      url: z.string().describe(parameterDescriptions.fetch.url),
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

/**
 * Check for SSL certificates and return HTTPS options if available
 */
function getHttpsOptions(): { key: Buffer; cert: Buffer } | null {
  const certPath = join(process.cwd(), 'certs', 'cert.pem');
  const keyPath = join(process.cwd(), 'certs', 'key.pem');
  
  if (existsSync(certPath) && existsSync(keyPath)) {
    try {
      const cert = readFileSync(certPath);
      const key = readFileSync(keyPath);
      
      if (debugMode) {
        console.error(`[DEBUG] Found SSL certificates:`);
        console.error(`[DEBUG]   - Certificate: ${certPath}`);
        console.error(`[DEBUG]   - Private Key: ${keyPath}`);
      }
      
      return { key, cert };
    } catch (error) {
      console.error(`⚠️  Error reading SSL certificates: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  return null;
}

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

    // Apply CORS middleware BEFORE other middleware
    app.use(
      cors({
        origin: '*',
        exposedHeaders: ['Mcp-Session-Id'],
        allowedHeaders: ['Content-Type', 'mcp-session-id', 'mcp-protocol-version'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: false
      })
    );

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

    // Check for HTTPS certificates
    const httpsOptions = getHttpsOptions();
    const protocol = httpsOptions ? 'https' : 'http';
    const protocolName = protocol.toUpperCase();

    if (httpsOptions) {
      // Create HTTPS server
      const httpsServer = https.createServer(httpsOptions, app);
      
      httpsServer.listen(port, () => {
        console.error(`🔒 MCP WebSearch server running on ${protocol}://localhost:${port}/mcp`);
        console.error("📜 Using SSL certificates from ./certs/ directory");
        console.error("Use --stdio flag to run in stdio mode");
        console.error(`Use --port=<number> to specify a different port (default: 3000)`);
        console.error("Use --debug flag to enable debug logging");
        console.error("💡 To disable HTTPS, remove or rename the ./certs/ directory");
        if (debugMode) console.error("Debug mode enabled");
      }).on('error', error => {
        console.error('HTTPS Server error:', error);
        process.exit(1);
      });
    } else {
      // Create HTTP server
      app.listen(port, () => {
        console.error(`🌐 MCP WebSearch server running on ${protocol}://localhost:${port}/mcp`);
        console.error("Use --stdio flag to run in stdio mode");
        console.error(`Use --port=<number> to specify a different port (default: 3000)`);
        console.error("Use --debug flag to enable debug logging");
        console.error("💡 Run 'npm run gencerts' to enable HTTPS with self-signed certificates");
        if (debugMode) console.error("Debug mode enabled");
      }).on('error', error => {
        console.error('HTTP Server error:', error);
        process.exit(1);
      });
    }
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});