# MCP WebSearch Server

A Model Context Protocol (MCP) server that provides intelligent web search and content fetching capabilities using the modern TypeScript SDK with dual transport support. Features DuckDuckGo as primary search engine with automatic Brave Search fallback.

## Features

### Dual Transport Support
- **HTTP Streaming** (default): Modern streamable HTTP transport for web-based clients
- **Stdio**: Traditional stdio transport for local/CLI clients
- **Custom Port**: Configurable port for HTTP mode

### Search Tool
- **Function**: `search`
- **Description**: Intelligent web search with DuckDuckGo as primary engine and Brave Search as automatic fallback
- **Parameters**:
  - `query` (required): Search query string
  - `maxResults` (optional): Maximum number of results (default: 10, max: 50)
  - `dateFilter` (optional): Filter by date - "d" (day), "w" (week), "m" (month), "y" (year)

**Returns**: Array of search results with:
- Title
- URL
- Keywords (extracted intelligently)
- Summary (smart content analysis, not just first paragraph)
- Search provider used (DuckDuckGo, Brave, or "Brave (DDG suspended)")

**Advanced Features**:
- **Automatic Fallback**: Switches to Brave Search when DuckDuckGo is rate limited or blocked
- **Rate Limiting Protection**: Intelligent request spacing and user agent rotation
- **Suspension Logic**: Temporarily suspends problematic providers with exponential backoff
- **Preferred Sites**: Automatically enhances queries by adding `site:` operators for relevant domains based on keyword matching. Configure via `preferred_sites.json` in the project root.

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
- **`src/tools/search-tool.ts`**: Multi-provider search implementation with intelligent fallback
- **`src/tools/fetch-tool.ts`**: URL content fetching implementation
- **`src/providers/`**: Search provider implementations (DuckDuckGo, Brave)
- **`src/utils/`**: Shared utilities (request management, preferred sites)

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
- **Search Tool**: Shows query, provider selection, and HTTP response codes
- **Fetch Tool**: Shows URL and HTTP response codes for failed requests
- **Provider Fallback**: Shows when switching between DuckDuckGo and Brave Search
- **Rate Limiting Detection**: Identifies when providers may be blocking automated requests

```bash
# Example debug output for provider fallback
[DEBUG] DuckDuckGo appears rate limited, suspending and falling back to Brave
[DEBUG] DuckDuckGo suspended for 20 minutes (suspension #1)
[DEBUG] Using Brave Search as fallback

# Example debug output for rate limiting
[DEBUG] Rate limited by DuckDuckGo: HTTP 429 Too Many Requests
[DEBUG] Possible rate limiting detected for query "test"
[DEBUG] Received homepage instead of search results (14262 chars)

# Example debug output for successful search
[DEBUG] DuckDuckGo working normally, reset suspension count
```

### Rate Limiting & Provider Management

The search tool intelligently manages multiple providers to ensure reliable results:

- **Automatic Detection**: Detects 429 (Too Many Requests), 503 (Service Unavailable), 403 (Forbidden)
- **Content Analysis**: Identifies when homepage is served instead of search results
- **Provider Suspension**: Temporarily suspends problematic providers with exponential backoff
- **Seamless Fallback**: Automatically switches to Brave Search when DuckDuckGo is unavailable
- **CAPTCHA Detection**: Recognizes CAPTCHA challenges in responses
- **Pattern Matching**: Detects "blocked" or "too many requests" messages

When rate limiting is detected, the tool will show specific debug messages indicating the type of blocking encountered.

## Provider Architecture

The search functionality uses a clean provider architecture for maintainability and reliability:

### Search Providers
- **DuckDuckGo Provider** (`src/providers/duckduckgo-provider.ts`): Primary search engine with comprehensive rate limiting detection
- **Brave Provider** (`src/providers/brave-provider.ts`): Fallback search engine with enhanced query formatting and quality filtering
- **Base Provider** (`src/providers/base-provider.ts`): Shared functionality for keyword extraction, summary generation, and domain parsing

### Fallback Logic
1. **Primary**: Attempts DuckDuckGo search first
2. **Detection**: Monitors for rate limiting, blocking, or poor results
3. **Suspension**: Temporarily suspends DuckDuckGo with exponential backoff (20min → 40min → 80min)
4. **Fallback**: Switches to Brave Search during suspension periods
5. **Recovery**: Automatically resumes DuckDuckGo when suspension expires

### Benefits
- **Reliability**: Never fails due to single provider issues
- **Quality**: Brave Search provides excellent results when DuckDuckGo is unavailable
- **Maintainability**: Easy to add new search providers or modify existing ones
- **Transparency**: Response indicates which provider was used

## License

MIT