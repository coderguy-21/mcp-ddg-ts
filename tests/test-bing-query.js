import { WebSearchTool } from '../dist/tools/search-tool.js';

async function testBingQueryHandling() {
  console.log('Testing Bing Query Handling...\n');
  
  const searchTool = new WebSearchTool(true); // Enable debug mode
  
  try {
    console.log('=== Test 1: Simple query ===');
    const result1 = await searchTool.execute({
      query: 'hello world',
      maxResults: 2
    });
    
    const data1 = JSON.parse(result1.content[0].text);
    console.log(`Provider: ${data1.searchProvider}`);
    console.log(`First result: ${data1.results[0]?.title}`);
    
    console.log('\n=== Test 2: Complex query (IBM revenue 2018) ===');
    const result2 = await searchTool.execute({
      query: 'IBM revenue in 2018',
      maxResults: 2
    });
    
    const data2 = JSON.parse(result2.content[0].text);
    console.log(`Provider: ${data2.searchProvider}`);
    console.log(`First result: ${data2.results[0]?.title}`);
    console.log(`First result URL: ${data2.results[0]?.url}`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testBingQueryHandling();