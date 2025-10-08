#!/usr/bin/env node

// Test script for preferred sites functionality
import { DuckDuckGoSearchTool } from "./dist/tools/search-tool.js";

async function testPreferredSites() {
  console.log("Testing Preferred Sites Functionality");
  console.log("=====================================");
  
  const searchTool = new DuckDuckGoSearchTool(true); // Enable debug mode
  
  // Test cases that should trigger preferred sites
  const testQueries = [
    "javascript async functions",
    "node npm install error", 
    "typescript tutorial",
    "github repository search",
    "python programming" // Should not match any preferred sites
  ];

  for (const query of testQueries) {
    console.log(`\nTesting query: "${query}"`);
    console.log("-".repeat(50));
    
    try {
      const result = await searchTool.execute({ query, maxResults: 2 });
      const parsed = JSON.parse(result.content[0].text);
      console.log(`Result query: ${parsed.query}`);
      console.log(`Results found: ${parsed.totalResults}`);
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }
}

testPreferredSites().catch(console.error);