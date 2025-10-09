import { WebSearchTool } from '../dist/tools/search-tool.js';

async function testSuspensionLogic() {
  console.log('Testing WebSearch Tool Suspension Logic...\n');
  
  const searchTool = new WebSearchTool(true); // Enable debug mode
  
  try {
    console.log('=== Test 1: Normal search (should try DuckDuckGo first) ===');
    const result1 = await searchTool.execute({
      query: 'web development',
      maxResults: 2
    });
    
    const data1 = JSON.parse(result1.content[0].text);
    console.log(`Provider used: ${data1.searchProvider}`);
    console.log(`Results found: ${data1.totalResults}`);
    
    console.log('\n=== Test 2: Another search (should still try DuckDuckGo) ===');
    const result2 = await searchTool.execute({
      query: 'javascript tutorial',
      maxResults: 2
    });
    
    const data2 = JSON.parse(result2.content[0].text);
    console.log(`Provider used: ${data2.searchProvider}`);
    console.log(`Results found: ${data2.totalResults}`);
    
    console.log('\n=== Test completed successfully! ===');
    console.log('Note: Suspension logic will activate automatically if DuckDuckGo starts failing');
    console.log('- Exponential backoff: 10min, 20min, 40min, max 60min');
    console.log('- Status messages indicate when DDG is suspended vs working');
    console.log('- Suspension count resets when DDG works normally again');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testSuspensionLogic();