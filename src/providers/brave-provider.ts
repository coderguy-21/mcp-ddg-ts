import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { SearchProvider, SearchResult } from "./base-provider.js";

export class BraveProvider extends SearchProvider {
  private readonly baseUrl = "https://search.brave.com/search";

  get name(): string {
    return "Brave";
  }

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    const params = new URLSearchParams();
    
    // Format the query for Brave Search
    let searchQuery = query;
    
    // If the query has site: operators, format them properly for Brave
    if (query.includes('site:') || query.includes('OR site:')) {
      // Keep the enhanced query but clean up the format for Brave
      searchQuery = query.replace(/\(site:/g, 'site:').replace(/\)/g, '');
      if (this.debug) {
        console.error(`[DEBUG] Using enhanced query with site operators for Brave: "${searchQuery}"`);
      }
    }
    
    // Use the enhanced query for Brave search
    params.append("q", searchQuery);
    
    const searchUrl = `${this.baseUrl}?${params.toString()}`;
    
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
    return this.parseSearchResults(html, maxResults);
  }

  private parseSearchResults(html: string, maxResults: number): SearchResult[] {
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
        
        // Basic validation - ensure we have valid title and URL
        if (!title || !url || url.length < 10) {
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
}