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

export interface SearchResponse {
  query: string;
  totalResults: number;
  searchProvider: "DuckDuckGo" | "Brave" | "Brave (DDG suspended)";
  results: SearchResult[];
}

export class WebSearchTool {
  private readonly duckDuckGoUrl = "https://duckduckgo.com/html/";
  private readonly braveUrl = "https://search.brave.com/search";
  private readonly debug: boolean;
  private readonly preferredSites: PreferredSitesManager;
  private readonly requestManager: RequestManager;
  
  // Suspension tracking for DuckDuckGo
  private static duckDuckGoSuspendedUntil: number = 0;
  private static readonly SUSPENSION_DURATION = 20 * 60 * 1000; // 20 minutes
  private static suspensionCount = 0;

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
      
      // Check if DuckDuckGo is currently suspended
      const now = Date.now();
      const isDuckDuckGoSuspended = now < WebSearchTool.duckDuckGoSuspendedUntil;
      
      if (isDuckDuckGoSuspended && this.debug) {
        const suspendedMinutes = Math.ceil((WebSearchTool.duckDuckGoSuspendedUntil - now) / (60 * 1000));
        console.error(`[DEBUG] DuckDuckGo suspended for ${suspendedMinutes} more minutes (suspension #${WebSearchTool.suspensionCount}), using Brave directly`);
      }
      
      // Try DuckDuckGo first (unless suspended)
      let searchResponse: SearchResponse;
      if (!isDuckDuckGoSuspended) {
        try {
          const results = await this.searchDuckDuckGo(enhancedQuery, maxResults, dateFilter);
          
          // Check if DuckDuckGo results seem valid (not rate limited)
          if (results.length === 0 && this.isLikelyRateLimited(enhancedQuery)) {
            if (this.debug) {
              console.error('[DEBUG] DuckDuckGo appears rate limited, suspending and falling back to Brave');
            }
            this.suspendDuckDuckGo();
            throw new Error('DuckDuckGo rate limited');
          }
          
          searchResponse = {
            query: enhancedQuery !== query ? `${query} (enhanced: ${enhancedQuery})` : query,
            totalResults: results.length,
            searchProvider: "DuckDuckGo",
            results,
          };
          
          // Reset suspension count on successful DuckDuckGo search
          if (WebSearchTool.suspensionCount > 0) {
            WebSearchTool.suspensionCount = 0;
            if (this.debug) {
              console.error('[DEBUG] DuckDuckGo working normally, reset suspension count');
            }
          }
        } catch (ddgError) {
          if (this.debug) {
            console.error(`[DEBUG] DuckDuckGo failed: ${ddgError instanceof Error ? ddgError.message : String(ddgError)}`);
            console.error('[DEBUG] Suspending DuckDuckGo and attempting Brave fallback...');
          }
          
          // Suspend DuckDuckGo and fall back to Brave
          this.suspendDuckDuckGo();
          const results = await this.searchBrave(enhancedQuery, maxResults);
          searchResponse = {
            query: enhancedQuery !== query ? `${query} (enhanced: ${enhancedQuery})` : query,
            totalResults: results.length,
            searchProvider: "Brave",
            results,
          };
        }
      } else {
        // DuckDuckGo is suspended, go straight to Brave
        const results = await this.searchBrave(enhancedQuery, maxResults);
        searchResponse = {
          query: enhancedQuery !== query ? `${query} (enhanced: ${enhancedQuery})` : query,
          totalResults: results.length,
          searchProvider: "Brave (DDG suspended)",
          results,
        };
      }
      
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(searchResponse, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Search failed on all providers: ${error instanceof Error ? error.message : String(error)}`);
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

    const searchUrl = `${this.duckDuckGoUrl}?${params.toString()}`;
    
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

  private async searchBrave(query: string, maxResults: number): Promise<SearchResult[]> {
    const params = new URLSearchParams();
    
    // Try using the enhanced query with site: operators for Brave
    // Brave Search should support site: operators like most search engines
    let searchQuery = query;
    
    // If the query has site: operators, let's test if Brave handles them well
    if (query.includes('site:') || query.includes('OR site:')) {
      // Keep the enhanced query but clean up the format for Brave
      searchQuery = query.replace(/\(site:/g, 'site:').replace(/\)/g, '');
      if (this.debug) {
        console.error(`[DEBUG] Using enhanced query with site operators for Brave: "${searchQuery}"`);
      }
    }
    
    // Use the enhanced query for Brave search
    params.append("q", searchQuery);
    
    const searchUrl = `${this.braveUrl}?${params.toString()}`;
    
    if (this.debug) {
      console.error(`[DEBUG] Brave Search URL: ${searchUrl}`);
      if (searchQuery !== query) {
        console.error(`[DEBUG] Formatted query for Brave: "${query}" -> "${searchQuery}"`);
      }
    }
    
    // Use request manager to prevent rate limiting
    await this.requestManager.waitForRequest();
    await this.requestManager.addRandomDelay();
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": this.requestManager.getUserAgent(),
        ...this.requestManager.getRandomHeaders(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!response.ok) {
      if (this.debug) {
        console.error(`[DEBUG] Brave search failed for query "${query}": HTTP ${response.status} ${response.statusText}`);
      }
      throw new Error(`Brave HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseBraveResults(html, maxResults);
  }

  private parseBraveResults(html: string, maxResults: number): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    
    if (this.debug) {
      console.error(`[DEBUG] Parsing Brave results from ${html.length} character response`);
    }
    
    // Brave search results can be in different selectors
    const selectors = [".snippet", ".web-result", ".result"];
    let foundResults = false;
    
    for (const selector of selectors) {
      if (foundResults && results.length > 0) break;
      
      $(selector).each((index: number, element: any) => {
        if (results.length >= maxResults) return false;
        
        const $result = $(element);
        
        // Extract title and URL with multiple fallback selectors for Brave
        let titleElement = $result.find("h3 a, .title a, .result-title a, a[href]").first();
        
        const title = titleElement.text().trim();
        let url = titleElement.attr("href") || "";
        
        // Clean up relative URLs if needed
        if (url.startsWith('/')) {
          url = `https://search.brave.com${url}`;
        }
        
        // Basic quality filtering - exclude obvious spam/irrelevant results
        const blockedDomains = ['jlaforums.com', 'spam-site.com'];
        const lowercaseTitle = title.toLowerCase();
        const lowercaseUrl = url.toLowerCase();
        
        const isDomainBlocked = blockedDomains.some(domain => 
          lowercaseUrl.includes(domain)
        );
        
        if (!title || !url || url.length < 10 || isDomainBlocked) {
          if (this.debug && isDomainBlocked) {
            console.error(`[DEBUG] Filtered blocked result: ${title} - ${url}`);
          }
          return;
        }
        
        // Extract snippet for summary with Brave-specific selectors
        let snippet = $result.find(".snippet-description, .description, .snippet-content").text().trim();
        if (!snippet) {
          snippet = $result.find("p").first().text().trim();
        }
        
        // Generate keywords from title and snippet
        const keywords = this.extractKeywords(title, snippet);
        
        // Create intelligent summary
        const summary = this.createIntelligentSummary(title, snippet, url);
        
        if (this.debug) {
          console.error(`[DEBUG] Adding Brave result: ${title.substring(0, 50)}...`);
        }
        
        results.push({
          title,
          url,
          keywords,
          summary,
        });
        
        foundResults = true;
      });
    }

    if (this.debug) {
      console.error(`[DEBUG] Extracted ${results.length} results from Brave`);
    }

    return results;
  }

  private isLikelyRateLimited(query: string): boolean {
    // This is a simple heuristic - in a real implementation you might want to cache
    // recent failed requests or check response content for rate limiting indicators
    return true; // For now, always try Bing if DDG returns no results
  }

  private suspendDuckDuckGo(): void {
    const now = Date.now();
    WebSearchTool.suspensionCount++;
    
    // Exponential backoff: 20 minutes, 40 minutes, 80 minutes, max 120 minutes
    const backoffMultiplier = Math.min(Math.pow(2, WebSearchTool.suspensionCount - 1), 6);
    const suspensionDuration = WebSearchTool.SUSPENSION_DURATION * backoffMultiplier;
    
    WebSearchTool.duckDuckGoSuspendedUntil = now + suspensionDuration;
    
    if (this.debug) {
      const suspensionMinutes = Math.ceil(suspensionDuration / (60 * 1000));
      console.error(`[DEBUG] DuckDuckGo suspended for ${suspensionMinutes} minutes (suspension #${WebSearchTool.suspensionCount})`);
    }
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