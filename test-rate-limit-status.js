#!/usr/bin/env node

// Simple test to check if rate limiting has been resolved
import { DuckDuckGoSearchTool } from "./dist/tools/search-tool.js";

async function testRateLimitStatus() {
  console.log("Testing Current Rate Limit Status");
  console.log("=================================");
  
  const searchTool = new DuckDuckGoSearchTool(true); // Enable debug mode
  
  // Use a simple, common query that should return results
  const testQuery = "weather today";
  
  try {
    console.log(`Testing with simple query: "${testQuery}"`);
    console.log("Checking if DuckDuckGo is still rate limiting...\n");
    
    const result = await searchTool.execute({ query: testQuery, maxResults: 3 });
    const parsed = JSON.parse(result.content[0].text);
    
    if (parsed.totalResults > 0) {
      console.log(`✅ SUCCESS: Found ${parsed.totalResults} results`);
      console.log("Rate limiting appears to be resolved!");
      console.log("\nFirst result:");
      console.log(`- Title: ${parsed.results[0].title}`);
      console.log(`- URL: ${parsed.results[0].url}`);
    } else {
      console.log("❌ STILL BLOCKED: No results returned");
      console.log("Rate limiting is still active. Try again later.");
    }
    
  } catch (error) {
    console.error(`❌ ERROR: ${error}`);
    console.log("Rate limiting or other issues are still present.");
  }
  
  console.log("\n💡 TIP: If still blocked, try waiting 1-4 hours and test again.");
}

testRateLimitStatus().catch(console.error);