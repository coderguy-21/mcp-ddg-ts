import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { userAgents } from "../descriptions.js";

export interface FetchArguments {
  url: string;
}

export interface FetchResult {
  url: string;
  title: string;
  content: string;
  summary: string;
  keywords: string[];
  metadata: {
    domain: string;
    contentType?: string;
    contentLength?: number;
    lastModified?: string;
  };
}

export class ContentFetchTool {
  private readonly timeout = 10000; // 10 seconds
  private readonly debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  async execute(args: FetchArguments) {
    const { url } = args;

    if (!url || !this.isValidUrl(url)) {
      throw new Error("Valid URL parameter is required");
    }

    try {
      const result = await this.fetchContent(url);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  private async fetchContent(url: string): Promise<FetchResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgents.fetchAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (this.debug) {
          console.error(`[DEBUG] Fetch failed for URL "${url}": HTTP ${response.status} ${response.statusText}`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("text/html")) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      const html = await response.text();
      const parsed = this.parseHtmlContent(html, url);

      return {
        ...parsed,
        metadata: {
          domain: this.extractDomain(url),
          contentType,
          contentLength: html.length,
          lastModified: response.headers.get("last-modified") || undefined,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw error;
    }
  }

  private parseHtmlContent(html: string, url: string): Omit<FetchResult, "metadata"> {
    const $ = cheerio.load(html);

    // Extract title
    const title = this.extractTitle($);

    // Extract main content
    const content = this.extractMainContent($);

    // Generate keywords
    const keywords = this.extractKeywords(title, content);

    // Create intelligent summary
    const summary = this.createIntelligentSummary(title, content, url);

    return {
      url,
      title,
      content,
      summary,
      keywords,
    };
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple sources for title
    const sources = [
      $("title").text(),
      $('meta[property="og:title"]').attr("content"),
      $('meta[name="twitter:title"]').attr("content"),
      $("h1").first().text(),
    ];

    for (const source of sources) {
      if (source && source.trim()) {
        return source.trim();
      }
    }

    return "Untitled Document";
  }

  private extractMainContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $("script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar").remove();

    // Try to find main content areas
    const contentSelectors = [
      "main",
      "article",
      ".content",
      ".main-content",
      ".post-content",
      ".entry-content",
      "#content",
      "#main",
      ".container",
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > 100) {
          return this.cleanText(text);
        }
      }
    }

    // Fallback to body content
    const bodyText = $("body").text().trim();
    return this.cleanText(bodyText);
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ") // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, "\n\n") // Clean up line breaks
      .trim()
      .substring(0, 5000); // Limit content length
  }

  private extractKeywords(title: string, content: string): string[] {
    const text = `${title} ${content}`.toLowerCase();
    const words = text.match(/\b[a-z]{4,}\b/g) || [];

    // Extended stop words list
    const stopWords = new Set([
      "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use", "with", "have", "this", "will", "your", "from", "they", "know", "want", "been", "good", "much", "some", "time", "very", "when", "come", "here", "just", "like", "long", "make", "many", "over", "such", "take", "than", "them", "well", "were"
    ]);

    const filtered = words.filter(word => !stopWords.has(word) && word.length >= 4);

    // Count frequency
    const wordCount = new Map<string, number>();
    filtered.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Return top keywords (minimum frequency of 2 for longer content)
    const minFreq = content.length > 1000 ? 2 : 1;
    return Array.from(wordCount.entries())
      .filter(([, count]) => count >= minFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);
  }

  private createIntelligentSummary(title: string, content: string, url: string): string {
    if (!content || content.length < 50) {
      return `Content from ${this.extractDomain(url)}: ${title}`;
    }

    // Split content into paragraphs and sentences
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 20);

    if (paragraphs.length === 0) {
      return this.createFallbackSummary(content, title);
    }

    // Find the most substantial paragraph (not the first, which might be navigation)
    let bestParagraph = paragraphs[0];
    let bestScore = 0;

    for (let i = 0; i < Math.min(paragraphs.length, 5); i++) {
      const paragraph = paragraphs[i];
      const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 10);

      // Score based on length, sentence count, and position
      const lengthScore = Math.min(paragraph.length / 200, 1);
      const sentenceScore = Math.min(sentences.length / 3, 1);
      const positionScore = i === 0 ? 0.8 : 1; // Slight penalty for first paragraph

      const score = (lengthScore + sentenceScore) * positionScore;

      if (score > bestScore && paragraph.length > 80) {
        bestScore = score;
        bestParagraph = paragraph;
      }
    }

    // Extract 2-3 key sentences from the best paragraph
    const sentences = bestParagraph.split(/[.!?]+/).filter(s => s.trim().length > 15);
    let summary = "";

    for (let i = 0; i < Math.min(sentences.length, 3); i++) {
      const sentence = sentences[i].trim();
      if ((summary + sentence).length <= 300) {
        summary += sentence + ". ";
      } else {
        break;
      }
    }

    // Ensure we have a reasonable summary
    if (summary.length < 80) {
      return this.createFallbackSummary(content, title);
    }

    return summary.trim();
  }

  private createFallbackSummary(content: string, title: string): string {
    const words = content.split(/\s+/);
    const summaryWords = words.slice(0, 50);
    let summary = summaryWords.join(" ");

    if (summary.length < 100) {
      summary = `${title}: ${summary}`;
    }

    // Clean up and ensure proper ending
    summary = summary.replace(/[.!?]*$/, "");
    if (summary.length > 200) {
      summary = summary.substring(0, 197) + "...";
    } else {
      summary += ".";
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