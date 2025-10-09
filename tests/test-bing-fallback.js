import { WebSearchTool } from '../dist/tools/search-tool.js';

async function testBingFallback() {
  console.log('Testing Bing Fallback Specifically...\n');
  
  const searchTool = new WebSearchTool(true); // Enable debug mode
  
  try {
    console.log('=== Testing Bing search directly ===');
    
    // Access the private method for testing (this is a bit hacky but needed for testing)
    const searchBing = searchTool.searchBing || searchTool.constructor.prototype.searchBing;
    
    if (!searchBing) {
      console.log('Testing via regular search (may use DDG or Bing depending on rate limiting)...');
      
      const result = await searchTool.execute({
        query: 'Model Context Protocol MCP tutorial',
        maxResults: 2
      });
      
      console.log('\n=== Search Results ===');
      const data = JSON.parse(result.content[0].text);
      
      console.log(`Query: ${data.query}`);
      console.log(`Search Provider: ${data.searchProvider}`);
      console.log(`Total Results: ${data.totalResults}`);
      console.log('\nResults:');
      
      data.results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.title}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Summary: ${result.summary}`);
      });
    }
    
  } catch (error) {
    console.error('Search failed:', error.message);
  }
}

testBingFallback();