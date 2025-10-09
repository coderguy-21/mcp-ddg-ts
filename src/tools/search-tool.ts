import { PreferredSitesManager } from "../utils/preferred-sites.js";
import { SearchResult, DuckDuckGoProvider, BraveProvider } from "../providers/index.js";

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
  private readonly debug: boolean;
  private readonly preferredSites: PreferredSitesManager;
  private readonly duckDuckGoProvider: DuckDuckGoProvider;
  private readonly braveProvider: BraveProvider;

  // Suspension tracking for DuckDuckGo
  private static duckDuckGoSuspendedUntil: number = 0;
  private static readonly SUSPENSION_DURATION = 20 * 60 * 1000; // 20 minutes
  private static suspensionCount = 0;

  constructor(debug: boolean = false) {
    this.debug = debug;
    this.preferredSites = new PreferredSitesManager(debug);
    this.duckDuckGoProvider = new DuckDuckGoProvider(debug);
    this.braveProvider = new BraveProvider(debug);
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
          const results = await this.duckDuckGoProvider.search(enhancedQuery, maxResults, dateFilter);

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
          const results = await this.braveProvider.search(enhancedQuery, maxResults);
          searchResponse = {
            query: enhancedQuery !== query ? `${query} (enhanced: ${enhancedQuery})` : query,
            totalResults: results.length,
            searchProvider: "Brave",
            results,
          };
        }
      } else {
        // DuckDuckGo is suspended, go straight to Brave
        const results = await this.braveProvider.search(enhancedQuery, maxResults);
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

  private isLikelyRateLimited(query: string): boolean {
    // This is a simple heuristic - in a real implementation you might want to cache
    // recent failed requests or check response content for rate limiting indicators
    return true; // For now, always try Brave if DDG returns no results
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
}