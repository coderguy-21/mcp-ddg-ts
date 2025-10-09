import { WebSearchTool } from '../dist/tools/search-tool.js';

async function testSimpleSearch() {
  console.log('Testing Simple Search...\n');
  
  const searchTool = new WebSearchTool(true); // Enable debug mode
  
  try {
    console.log('=== Testing with a simple query ===');
    
    const result = await searchTool.execute({
      query: 'hello world',
      maxResults: 2
    });
    
    console.log('\n=== Search Results ===');
    const data = JSON.parse(result.content[0].text);
    
    console.log(`Query: ${data.query}`);
    console.log(`Search Provider: ${data.searchProvider}`);
    console.log(`Total Results: ${data.totalResults}`);
    
    if (data.results && data.results.length > 0) {
      console.log('\nFirst result:');
      console.log(`Title: ${data.results[0].title}`);
      console.log(`URL: ${data.results[0].url}`);
    }
    
    console.log('\n✓ Search completed successfully!');
    
  } catch (error) {
    console.error('✗ Search failed:', error.message);
  }
}

testSimpleSearch().then(() => {
  console.log('Test completed!');
  process.exit(0);
}).catch(err => {
  console.error('Test errored:', err);
  process.exit(1);
});