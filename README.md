# MCP DuckDuckGo Server

A Model Context Protocol (MCP) server that provides DuckDuckGo search and web content fetching capabilities using the modern TypeScript SDK with dual transport support.

## Features

### Dual Transport Support
- **HTTP Streaming** (default): Modern streamable HTTP transport for web-based clients
- **Stdio**: Traditional stdio transport for local/CLI clients
- **Custom Port**: Configurable port for HTTP mode

### Search Tool
- **Function**: `search`
- **Description**: Search DuckDuckGo for web results with intelligent content parsing
- **Parameters**:
  - `query` (required): Search query string
  - `maxResults` (optional): Maximum number of results (default: 10, max: 50)
  - `dateFilter` (optional): Filter by date - "d" (day), "w" (week), "m" (month), "y" (year)

**Returns**: Array of search results with:
- Title
- URL
- Keywords (extracted intelligently)
- Summary (smart content analysis, not just first paragraph)

**Preferred Sites**: Automatically enhances queries by adding `site:` operators for relevant domains based on keyword matching. Configure via `preferred_sites.json` in the project root.

### Fetch Tool
- **Function**: `fetch`
- **Description**: Fetch and extract content from any URL with intelligent parsing
- **Parameters**:
  - `url` (required): URL to fetch content from

**Returns**: Detailed content analysis including:
- Title (from multiple sources: title tag, og:title, h1, etc.)
- Main content (intelligently extracted, avoiding navigation/ads)
- Keywords (frequency-based with stop word filtering)
- Summary (smart paragraph selection and sentence extraction)
- Metadata (domain, content type, size, last modified)

## Architecture

The project follows a clean architecture pattern with modern MCP SDK:

- **`src/index.ts`**: Main MCP server using `McpServer` and dual transport support
- **`src/tools/search-tool.ts`**: DuckDuckGo search implementation
- **`src/tools/fetch-tool.ts`**: URL content fetching implementation

## Usage

### HTTP Streaming Mode (Default)
```bash
npm start
# Server runs on http://localhost:3000/mcp

# Custom port
npm start -- --port=4000
# Server runs on http://localhost:4000/mcp

# With debug logging
npm start -- --debug
# Shows debug messages for HTTP errors
```

### Stdio Mode
```bash
npm start -- --stdio
# Server runs on stdio for direct communication

# With debug logging
npm start -- --stdio --debug
# Shows debug messages for HTTP errors
```

### Development
```bash
npm run build  # Build TypeScript
npm run dev    # Build and start
npm run watch  # Watch mode for development
```

## Installation

```bash
npm install
```

## Dependencies

- `@modelcontextprotocol/sdk`: Latest MCP TypeScript SDK with modern API
- `express`: HTTP server for streaming transport
- `zod`: Schema validation for tool parameters
- `cheerio`: Server-side HTML parsing
- `node-fetch`: HTTP client for web requests

## Example Usage

### HTTP Client
POST to `http://localhost:3000/mcp` with MCP protocol messages.

### Search Example
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {
      "query": "artificial intelligence",
      "maxResults": 5,
      "dateFilter": "w"
    }
  }
}
```

### Fetch Example
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "fetch",
    "arguments": {
      "url": "https://example.com/article"
    }
  }
}
```

## Modern Features

- **Zod Schema Validation**: Type-safe parameter validation
- **Streamable HTTP Transport**: Modern HTTP-based communication
- **Express Integration**: Full Express.js server with middleware support
- **Dual Mode Support**: Both HTTP and stdio transports in one server
- **Clean Modern API**: Uses latest MCP SDK patterns with `McpServer`
- **Debug Logging**: Optional debug output for HTTP errors with `--debug` flag
- **Preferred Sites**: Intelligent query enhancement with domain-specific targeting
- **Intelligent Rate Limiting Protection**: Automatic request management to prevent blocking

## Intelligent Request Management

The search tool includes built-in protection against rate limiting:

### **Automatic Protections:**
- **Request Spacing**: Minimum 2-second delay between requests
- **Rate Limiting**: Maximum 10 requests per minute with automatic queuing
- **Random Delays**: 0-3 second random jitter to appear more human-like
- **User Agent Rotation**: Cycles through 5 different realistic browser user agents
- **Header Variation**: Randomly includes additional headers like DNT and Cache-Control

### **How It Works:**
```bash
[DEBUG] Request #1 approved (1 in last minute)
[DEBUG] Adding random delay: 2s
[DEBUG] Minimum delay protection: waiting 1s
[DEBUG] Rate limit protection: waiting 45s (10 requests in last minute)
```

The system automatically manages request timing to stay within reasonable limits and reduce the likelihood of being detected as a bot.

## Preferred Sites Configuration

Create a `preferred_sites.json` file in the project root to enable automatic query enhancement. The search tool will add `site:` operators to queries when keywords match.

### Example Configuration
```json
[
  {
    "url": "stackoverflow.com",
    "keywords": ["javascript", "typescript", "programming", "code", "error"]
  },
  {
    "url": "github.com", 
    "keywords": ["repository", "source code", "git", "open source"]
  }
]
```

### How It Works
- Scans your query for matching keywords
- Adds up to 4 relevant `site:` operators to the search
- Example: `"javascript error"` becomes `"javascript error (site:stackoverflow.com)"`
- Shows enhanced query in results when debug mode is enabled

## Error Handling

The server includes comprehensive error handling for:
- Invalid URLs and malformed requests
- Network timeouts (10 second limit)
- HTTP errors and connection issues (with optional debug logging)
- Content parsing failures
- Schema validation errors

### Debug Mode

Enable debug logging with the `--debug` flag to see detailed error information:
- **Search Tool**: Shows query and HTTP response codes for failed requests
- **Fetch Tool**: Shows URL and HTTP response codes for failed requests
- **Rate Limiting Detection**: Identifies when DuckDuckGo may be blocking automated requests

```bash
# Example debug output for failed search
[DEBUG] Search failed for query "test": HTTP 503 Service Unavailable

# Example debug output for rate limiting
[DEBUG] Rate limited by DuckDuckGo: HTTP 429 Too Many Requests
[DEBUG] Possible rate limiting detected for query "test"
[DEBUG] Received homepage instead of search results (14262 chars)

# Example debug output for failed fetch
[DEBUG] Fetch failed for URL "https://invalid-site.com": HTTP 404 Not Found
```

### Rate Limiting Detection

The search tool can detect when DuckDuckGo is blocking or rate limiting requests:

- **HTTP Status Codes**: Detects 429 (Too Many Requests), 503 (Service Unavailable), 403 (Forbidden)
- **Content Analysis**: Identifies when homepage is served instead of search results
- **CAPTCHA Detection**: Recognizes CAPTCHA challenges in responses
- **Pattern Matching**: Detects "blocked" or "too many requests" messages

When rate limiting is detected, the tool will show specific debug messages indicating the type of blocking encountered.

## License

MIT