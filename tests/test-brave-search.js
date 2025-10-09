import { WebSearchTool } from '../dist/tools/search-tool.js';

async function testBraveSearch() {
  console.log('Testing Brave Search Fallback...\n');
  
  const searchTool = new WebSearchTool(true); // Enable debug mode
  
  try {
    console.log('=== Test 1: Business query ===');
    const result1 = await searchTool.execute({
      query: 'IBM revenue 2018',
      maxResults: 3
    });
    
    const data1 = JSON.parse(result1.content[0].text);
    console.log(`Provider: ${data1.searchProvider}`);
    console.log(`Query: ${data1.query}`);
    console.log('\nResults:');
    
    data1.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Summary: ${result.summary.substring(0, 100)}...`);
    });
    
    console.log('\n=== Test 2: Technical query ===');
    const result2 = await searchTool.execute({
      query: 'TypeScript async await tutorial',
      maxResults: 2
    });
    
    const data2 = JSON.parse(result2.content[0].text);
    console.log(`\nProvider: ${data2.searchProvider}`);
    console.log(`Query: ${data2.query}`);
    console.log('\nResults:');
    
    data2.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testBraveSearch();