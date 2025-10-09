/**
 * Tool Descriptions for MCP WebSearch Server
 * 
 * This file contains human-readable descriptions for all MCP tools.
 * Descriptions are formatted with line breaks for easy editing.
 * 
 * EDITING GUIDELINES:
 * - Use bullet points (•) for feature lists
 * - Keep lines under 80 characters for readability
 * - Use .trim() to remove leading/trailing whitespace
 * - Maintain consistent formatting across descriptions
 * - Test with `npm run build` after changes
 */

export const toolDescriptions = {
  search: `
    Intelligent web search using DuckDuckGo as primary search engine with Brave Search as fallback.
    
    Features:
    • Automatic query enhancement using preferred sites configuration for tech queries 
      (GitHub, StackOverflow, MDN, etc.)
    • Built-in rate limiting protection with intelligent request spacing and header rotation
    • Automatic fallback to Brave Search when DuckDuckGo is rate limited or blocked
    • Rich results with extracted keywords and intelligent summaries
    • Search provider identification in results
    • Debug mode support for troubleshooting
    
    Results include title, URL, keywords array, intelligent summary, and search provider used.
    Handles up to 50 results with optional date filtering.
  `.trim(),

  fetch: `
    Fetch and extract content from a URL.
    
    Features:
    • Retrieves web page content from any accessible URL
    • Extracts text content from HTML pages
    • Handles various content types and encodings
    • Returns clean, readable text content
    • Error handling for inaccessible or invalid URLs
    
    Useful for retrieving specific content from web pages found through search results.
  `.trim()
};

/**
 * Input schema descriptions for tool parameters
 */
export const parameterDescriptions = {
  search: {
    query: 'Search query string - will be automatically enhanced with relevant site: operators if applicable',
    maxResults: 'Maximum number of results to return (default: 10, max: 50)',
    dateFilter: 'Filter results by date: d=past day, w=past week, m=past month, y=past year'
  },
  
  fetch: {
    url: 'URL to fetch content from'
  }
};

/**
 * User-Agent strings for web requests
 * These are rotated to avoid detection and blocking by websites
 */
export const userAgents = {
  // Used by RequestManager for search providers (rotated)
  searchAgents: [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
  ],
  
  // Used by ContentFetchTool for fetching web pages
  fetchAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};