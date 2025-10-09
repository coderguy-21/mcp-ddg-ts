import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { RequestManager } from "../utils/request-manager.js";

export interface SearchResult {
  title: string;
  url: string;
  keywords: string[];
  summary: string;
}

export abstract class SearchProvider {
  protected readonly debug: boolean;
  protected readonly requestManager: RequestManager;

  constructor(debug: boolean = false) {
    this.debug = debug;
    this.requestManager = RequestManager.getInstance(debug);
  }

  abstract get name(): string;
  abstract search(query: string, maxResults: number, dateFilter?: string): Promise<SearchResult[]>;

  protected extractKeywords(title: string, snippet: string): string[] {
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

  protected createIntelligentSummary(title: string, snippet: string, url: string): string {
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

  protected extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "unknown source";
    }
  }
}