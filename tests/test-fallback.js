import { WebSearchTool } from '../dist/tools/search-tool.js';

async function testFallback() {
  console.log('Testing Web Search Tool with Fallback...\n');
  
  const searchTool = new WebSearchTool(true); // Enable debug mode
  
  try {
    console.log('=== Testing search functionality ===');
    const result = await searchTool.execute({
      query: 'TypeScript MCP server development',
      maxResults: 3
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
      console.log(`   Keywords: ${result.keywords.join(', ')}`);
      console.log(`   Summary: ${result.summary}`);
    });
    
  } catch (error) {
    console.error('Search failed:', error.message);
  }
}

testFallback();