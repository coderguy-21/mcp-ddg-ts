import { userAgents } from "../descriptions.js";

/**
 * Request manager to help prevent rate limiting by DuckDuckGo
 */
export class RequestManager {
  private static instance: RequestManager;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly minDelay: number = 2000; // Minimum 2 seconds between requests
  private readonly maxRequestsPerMinute: number = 10; // Conservative limit
  private readonly requestTimes: number[] = [];
  private readonly debug: boolean;

  private constructor(debug: boolean = false) {
    this.debug = debug;
  }

  static getInstance(debug: boolean = false): RequestManager {
    if (!RequestManager.instance) {
      RequestManager.instance = new RequestManager(debug);
    }
    return RequestManager.instance;
  }

  /**
   * Wait for appropriate delay before making request
   */
  async waitForRequest(): Promise<void> {
    const now = Date.now();
    
    // Clean old request times (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    while (this.requestTimes.length > 0 && this.requestTimes[0] < oneMinuteAgo) {
      this.requestTimes.shift();
    }

    // Check if we're exceeding rate limits
    if (this.requestTimes.length >= this.maxRequestsPerMinute) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = oneMinuteAgo - oldestRequest + 1000; // Wait until oldest request is > 1 min old
      
      if (this.debug) {
        console.error(`[DEBUG] Rate limit protection: waiting ${Math.round(waitTime / 1000)}s (${this.requestTimes.length} requests in last minute)`);
      }
      
      await this.sleep(waitTime);
    }

    // Ensure minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelay) {
      const delayNeeded = this.minDelay - timeSinceLastRequest;
      
      if (this.debug) {
        console.error(`[DEBUG] Minimum delay protection: waiting ${Math.round(delayNeeded / 1000)}s`);
      }
      
      await this.sleep(delayNeeded);
    }

    // Record this request
    this.lastRequestTime = Date.now();
    this.requestTimes.push(this.lastRequestTime);
    this.requestCount++;

    if (this.debug) {
      console.error(`[DEBUG] Request #${this.requestCount} approved (${this.requestTimes.length} in last minute)`);
    }
  }

  /**
   * Add random jitter to make requests appear more human-like
   */
  async addRandomDelay(): Promise<void> {
    // Add 0-3 second random delay
    const randomDelay = Math.random() * 3000;
    
    if (this.debug) {
      console.error(`[DEBUG] Adding random delay: ${Math.round(randomDelay / 1000)}s`);
    }
    
    await this.sleep(randomDelay);
  }

  /**
   * Get a rotated user agent to vary requests
   */
  getUserAgent(): string {
    const index = this.requestCount % userAgents.searchAgents.length;
    return userAgents.searchAgents[index];
  }

  /**
   * Get additional headers to make requests more human-like
   */
  getRandomHeaders(): Record<string, string> {
    const baseHeaders: Record<string, string> = {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
    };

    // Randomly include some optional headers
    if (Math.random() > 0.5) {
      baseHeaders["DNT"] = "1";
    }
    
    if (Math.random() > 0.7) {
      baseHeaders["Cache-Control"] = "max-age=0";
    }

    return baseHeaders;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}