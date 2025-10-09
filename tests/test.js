#!/usr/bin/env node

// Simple test script to verify the MCP server functionality
// This is not a proper MCP client but demonstrates the tool functions

import { DuckDuckGoSearchTool } from "../dist/tools/search-tool.js";
import { ContentFetchTool } from "../dist/tools/fetch-tool.js";

async function testSearch() {
  console.log("Testing DuckDuckGo Search Tool...");
  const searchTool = new DuckDuckGoSearchTool();
  
  try {
    const result = await searchTool.execute({
      query: "TypeScript MCP server",
      maxResults: 3
    });
    
    console.log("Search Results:");
    console.log(result.content[0].text);
  } catch (error) {
    console.error("Search test failed:", error);
  }
}

async function testFetch() {
  console.log("\nTesting Content Fetch Tool...");
  const fetchTool = new ContentFetchTool();
  
  try {
    const result = await fetchTool.execute({
      url: "https://www.wikipedia.org"
    });
    
    console.log("Fetch Results:");
    const parsed = JSON.parse(result.content[0].text);
    console.log(`Title: ${parsed.title}`);
    console.log(`Summary: ${parsed.summary}`);
    console.log(`Keywords: ${parsed.keywords.join(", ")}`);
    console.log(`Domain: ${parsed.metadata.domain}`);
  } catch (error) {
    console.error("Fetch test failed:", error);
  }
}

async function main() {
  console.log("MCP DuckDuckGo Server Test Suite");
  console.log("=================================");
  
  await testSearch();
  await testFetch();
  
  console.log("\nTest completed!");
}

main().catch(console.error);