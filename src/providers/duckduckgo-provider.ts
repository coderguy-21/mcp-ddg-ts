import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { SearchProvider, SearchResult } from "./base-provider.js";

export class DuckDuckGoProvider extends SearchProvider {
  private readonly baseUrl = "https://duckduckgo.com/html/";

  get name(): string {
    return "DuckDuckGo";
  }

  async search(query: string, maxResults: number, dateFilter?: string): Promise<SearchResult[]> {
    const params = new URLSearchParams();
    params.append("q", query);
    params.append("b", ""); // Start from beginning
    
    if (dateFilter) {
      params.append("df", dateFilter);
    }

    const searchUrl = `${this.baseUrl}?${params.toString()}`;
    
    if (this.debug) {
      console.error(`[DEBUG] DuckDuckGo Search URL: ${searchUrl}`);
    }
    
    // Use request manager to prevent rate limiting
    await this.requestManager.waitForRequest();
    await this.requestManager.addRandomDelay();
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": this.requestManager.getUserAgent(),
        ...this.requestManager.getRandomHeaders(),
      },
    });

    if (!response.ok) {
      if (this.debug) {
        // Check for specific rate limiting status codes
        if (response.status === 429) {
          console.error(`[DEBUG] Rate limited by DuckDuckGo: HTTP 429 Too Many Requests`);
        } else if (response.status === 503) {
          console.error(`[DEBUG] Service unavailable (possible rate limiting): HTTP 503`);
        } else if (response.status === 403) {
          console.error(`[DEBUG] Access forbidden (possible IP blocking): HTTP 403`);
        } else {
          console.error(`[DEBUG] Search failed for query "${query}": HTTP ${response.status} ${response.statusText}`);
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const results = this.parseSearchResults(html, maxResults);
    
    // Check if we might be rate limited or blocked
    if (results.length === 0 && html.length > 10000) {
      // We got a substantial HTML response but no search results
      // This often indicates DuckDuckGo served the homepage instead of search results
      const isHomepage = html.includes('<title>DuckDuckGo</title>') || 
                        html.includes('duckduckgo.com/">') ||
                        !html.includes('class="result"');
      
      if (isHomepage && this.debug) {
        console.error(`[DEBUG] Possible rate limiting detected for query "${query}"`);
        console.error(`[DEBUG] Received homepage instead of search results (${html.length} chars)`);
      }
    }
    
    return results;
  }

  private parseSearchResults(html: string, maxResults: number): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    
    // Check for rate limiting indicators
    if (this.debug) {
      const captchaPresent = html.toLowerCase().includes('captcha') || 
                            html.toLowerCase().includes('verify you are human');
      const blockedMessage = html.toLowerCase().includes('blocked') ||
                            html.toLowerCase().includes('too many requests');
      const noResults = $(".result").length === 0 && 
                       !html.includes('No results found') &&
                       html.length > 5000; // Substantial response but no results
      
      if (captchaPresent) {
        console.error('[DEBUG] CAPTCHA challenge detected - likely rate limited');
      }
      if (blockedMessage) {
        console.error('[DEBUG] Blocked/rate limit message detected in response');
      }
      if (noResults) {
        console.error(`[DEBUG] No .result elements found in ${html.length} char response - possible rate limiting`);
      }
    }
    
    // DuckDuckGo HTML search results are in .result elements
    $(".result").each((index: number, element: any) => {
      if (results.length >= maxResults) return false;
      
      const $result = $(element);
      
      // Extract title and URL
      const titleElement = $result.find(".result__title a");
      const title = titleElement.text().trim();
      const url = titleElement.attr("href") || "";
      
      if (!title || !url) return;
      
      // Extract snippet for summary
      const snippet = $result.find(".result__snippet").text().trim();
      
      // Generate keywords from title and snippet
      const keywords = this.extractKeywords(title, snippet);
      
      // Create intelligent summary
      const summary = this.createIntelligentSummary(title, snippet, url);
      
      results.push({
        title,
        url,
        keywords,
        summary,
      });
    });

    return results;
  }
}