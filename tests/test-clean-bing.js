import { WebSearchTool } from '../dist/tools/search-tool.js';

async function testCleanBingQuery() {
  console.log('Testing Clean Bing Query (bypassing preferred sites)...\n');
  
  const searchTool = new WebSearchTool(true); // Enable debug mode
  
  try {
    // Create a query that won't match preferred sites to test raw Bing
    const result = await searchTool.execute({
      query: 'IBM annual revenue 2018 financial results',
      maxResults: 3
    });
    
    const data = JSON.parse(result.content[0].text);
    console.log(`Provider: ${data.searchProvider}`);
    console.log(`Query: ${data.query}`);
    console.log('\nResults:');
    
    data.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Summary: ${result.summary}`);
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testCleanBingQuery();