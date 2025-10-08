import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { PreferredSitesManager } from "../utils/preferred-sites.js";

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
  private readonly baseUrl = "https://html.duckduckgo.com/html/";
  private readonly userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
  private readonly debug: boolean;
  private readonly preferredSites: PreferredSitesManager;

  constructor(debug: boolean = false) {
    this.debug = debug;
    this.preferredSites = new PreferredSitesManager(debug);
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
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": this.userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
      },
    });

    if (!response.ok) {
      if (this.debug) {
        console.error(`[DEBUG] Search failed for query "${query}": HTTP ${response.status} ${response.statusText}`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseSearchResults(html, maxResults);
  }

  private parseSearchResults(html: string, maxResults: number): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    
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