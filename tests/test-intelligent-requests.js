#!/usr/bin/env node

// Test intelligent request management
import { WebSearchTool } from "../dist/tools/search-tool.js";

async function testIntelligentRequests() {
  console.log("Testing Intelligent Request Management");
  console.log("=====================================");
  
  const searchTool = new WebSearchTool(true); // Enable debug mode
  
  const testQueries = [
    "simple test query",
    "another test search", 
    "third test query"
  ];

  console.log("Making multiple requests to test rate limiting protection...\n");

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`Request ${i + 1}: "${query}"`);
    console.log("-".repeat(50));
    
    try {
      const startTime = Date.now();
      const result = await searchTool.execute({ query, maxResults: 2 });
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const parsed = JSON.parse(result.content[0].text);
      console.log(`✅ Completed in ${Math.round(duration / 1000)}s - Found ${parsed.totalResults} results`);
      
    } catch (error) {
      console.error(`❌ Error: ${error}`);
    }
    
    console.log("");
  }
  
  console.log("💡 Notice the delays and protections applied between requests");
}

testIntelligentRequests().catch(console.error);