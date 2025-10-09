import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { PreferredSitesManager } from "../utils/preferred-sites.js";
import { RequestManager } from "../utils/request-manager.js";

export interface SearchResult {
  title: string;
  url: string;
  keywords: string[];
  summary: string;
}

export interface SearchArguments {
  query: string;
  maxResults?: number;
  dateFilter?: "d" | "w" | "m" | "y";
}

export class DuckDuckGoSearchTool {
  private readonly baseUrl = "https://duckduckgo.com/html/";
  private readonly debug: boolean;
  private readonly preferredSites: PreferredSitesManager;
  private readonly requestManager: RequestManager;

  constructor(debug: boolean = false) {
    this.debug = debug;
    this.preferredSites = new PreferredSitesManager(debug);
    this.requestManager = RequestManager.getInstance(debug);
  }

  async execute(args: SearchArguments) {
    const { query, maxResults = 10, dateFilter } = args;
    
    if (!query || query.trim().length === 0) {
      throw new Error("Query parameter is required and cannot be empty");
    }

    if (maxResults > 50) {
      throw new Error("Maximum results cannot exceed 50");
    }

    try {
      // Enhance query with preferred sites if available
      const enhancedQuery = await this.preferredSites.enhanceQuery(query);
      const results = await this.searchDuckDuckGo(enhancedQuery, maxResults, dateFilter);
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              query: enhancedQuery !== query ? `${query} (enhanced: ${enhancedQuery})` : query,
              totalResults: results.length,
              results,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async searchDuckDuckGo(
    query: string,
    maxResults: number,
    dateFilter?: string
  ): Promise<SearchResult[]> {
    const params = new URLSearchParams();
    params.append("q", query);
    params.append("b", ""); // Start from beginning
    
    if (dateFilter) {
      params.append("df", dateFilter);
    }

    const searchUrl = `${this.baseUrl}?${params.toString()}`;
    
    if (this.debug) {
      console.error(`[DEBUG] Search URL: ${searchUrl}`);
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

  private extractKeywords(title: string, snippet: string): string[] {
    const text = `${title} ${snippet}`.toLowerCase();
    const words = text.match(/\b[a-z]{3,}\b/g) || [];
    
    // Filter out common stop words
    const stopWords = new Set([
      "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use"
    ]);
    
    const filtered = words.filter(word => !stopWords.has(word));
    
    // Count frequency and return top keywords
    const wordCount = new Map<string, number>();
    filtered.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private createIntelligentSummary(title: string, snippet: string, url: string): string {
    if (!snippet) {
      return `Content from ${this.extractDomain(url)}: ${title}`;
    }
    
    // Clean up the snippet
    let summary = snippet.replace(/\s+/g, " ").trim();
    
    // If snippet is very short, combine with title context
    if (summary.length < 50) {
      summary = `${title}: ${summary}`;
    }
    
    // If snippet is too long, intelligently truncate
    if (summary.length > 200) {
      // Try to find a natural break point (sentence end)
      const sentences = summary.split(/[.!?]+/);
      let truncated = sentences[0];
      
      for (let i = 1; i < sentences.length; i++) {
        if ((truncated + sentences[i]).length <= 180) {
          truncated += sentences[i] + ".";
        } else {
          break;
        }
      }
      
      summary = truncated.length > 50 ? truncated : summary.substring(0, 180) + "...";
    }
    
    // Ensure summary ends properly
    if (!summary.match(/[.!?]$/)) {
      summary += summary.length < 180 ? "." : "...";
    }
    
    return summary;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "unknown source";
    }
  }
}