import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PreferredSite {
  url: string;
  keywords: string[];
}

export class PreferredSitesManager {
  private sites: PreferredSite[] = [];
  private loaded = false;
  private readonly debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Load preferred sites from preferred_sites.json in project root
   */
  async loadSites(): Promise<void> {
    if (this.loaded) return;

    try {
      const filePath = join(process.cwd(), 'preferred_sites.json');
      const fileContent = await readFile(filePath, 'utf-8');
      const sites = JSON.parse(fileContent);

      if (!Array.isArray(sites)) {
        throw new Error('preferred_sites.json must contain an array');
      }

      this.sites = sites.filter(site => this.isValidSite(site));
      this.loaded = true;

      if (this.debug) {
        console.error(`[DEBUG] Loaded ${this.sites.length} preferred sites`);
      }
    } catch (error) {
      if (this.debug && (error as any).code !== 'ENOENT') {
        console.error(`[DEBUG] Failed to load preferred sites: ${(error as Error).message}`);
      }
      this.sites = [];
      this.loaded = true;
    }
  }

  /**
   * Validate that a site object has the required structure
   */
  private isValidSite(site: any): site is PreferredSite {
    return (
      typeof site === 'object' &&
      typeof site.url === 'string' &&
      Array.isArray(site.keywords) &&
      site.keywords.every((keyword: any) => typeof keyword === 'string')
    );
  }

  /**
   * Get matching sites for a query, limited to 4 sites
   */
  async getMatchingSites(query: string): Promise<string[]> {
    await this.loadSites();

    if (this.sites.length === 0) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const matchingSites: string[] = [];

    for (const site of this.sites) {
      if (matchingSites.length >= 4) {
        break;
      }

      // Check if any of the site's keywords are found in the query
      const hasMatch = site.keywords.some(keyword => 
        queryLower.includes(keyword.toLowerCase())
      );

      if (hasMatch) {
        matchingSites.push(site.url);
        if (this.debug) {
          const matchedKeywords = site.keywords.filter(keyword => 
            queryLower.includes(keyword.toLowerCase())
          );
          console.error(`[DEBUG] Query "${query}" matched site ${site.url} (keywords: ${matchedKeywords.join(', ')})`);
        }
      }
    }

    return matchingSites;
  }

  /**
   * Enhance a search query with preferred sites
   */
  async enhanceQuery(originalQuery: string): Promise<string> {
    const matchingSites = await this.getMatchingSites(originalQuery);
    
    if (matchingSites.length === 0) {
      return originalQuery;
    }

    // Add site: operators for matching sites
    const siteOperators = matchingSites.map(site => `site:${site}`).join(' OR ');
    const enhancedQuery = `${originalQuery} (${siteOperators})`;

    if (this.debug) {
      console.error(`[DEBUG] Using preferred sites for "${originalQuery}": ${matchingSites.join(', ')}`);
      console.error(`[DEBUG] Enhanced query: "${originalQuery}" -> "${enhancedQuery}"`);
    }

    return enhancedQuery;
  }
}