import { WebSearchTool } from '../dist/tools/search-tool.js';

async function testBravePreferredSites() {
  console.log('Testing Brave Search with Preferred Sites...\n');
  
  const searchTool = new WebSearchTool(true); // Enable debug mode
  
  try {
    console.log('=== Test 1: Query that should trigger preferred sites (JavaScript) ===');
    const result1 = await searchTool.execute({
      query: 'JavaScript async await tutorial',
      maxResults: 3
    });
    
    const data1 = JSON.parse(result1.content[0].text);
    console.log(`Provider: ${data1.searchProvider}`);
    console.log(`Original vs Enhanced Query:`);
    console.log(`${data1.query}`);
    console.log('\nResults:');
    
    data1.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      
      // Check if results are from preferred sites
      const preferredDomains = ['stackoverflow.com', 'medium.com', 'youtube.com', 'developer.mozilla.org'];
      const isFromPreferredSite = preferredDomains.some(domain => result.url.includes(domain));
      if (isFromPreferredSite) {
        console.log(`   ✅ FROM PREFERRED SITE!`);
      }
    });
    
    console.log('\n=== Test 2: Query without preferred site enhancement ===');
    const result2 = await searchTool.execute({
      query: 'weather forecast tomorrow',
      maxResults: 2
    });
    
    const data2 = JSON.parse(result2.content[0].text);
    console.log(`\nProvider: ${data2.searchProvider}`);
    console.log(`Query: ${data2.query}`);
    console.log(`Results count: ${data2.totalResults}`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testBravePreferredSites();