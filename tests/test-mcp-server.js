// Test MCP WebSearch server functionality
import fetch from 'node-fetch';

async function testMCPWebSearchServer() {
  try {
    console.log('Testing MCP WebSearch Server...\n');
    
    // Test tools/list first
    const listResponse = await fetch('http://localhost:3000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      })
    });
    
    const listData = await listResponse.json();
    console.log('=== Available Tools ===');
    console.log(`Server name: ${JSON.stringify(listData.result?.tools?.[0]?.title)}`);
    console.log(`Server description length: ${listData.result?.tools?.[0]?.description?.length} chars`);
    
    // Test search tool with suspension detection
    const searchResponse = await fetch('http://localhost:3000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'search',
          arguments: {
            query: 'TypeScript best practices',
            maxResults: 2
          }
        }
      })
    });
    
    const searchData = await searchResponse.json();
    console.log('\n=== Search Results ===');
    if (searchData.result?.content?.[0]?.text) {
      const results = JSON.parse(searchData.result.content[0].text);
      console.log(`Query: ${results.query}`);
      console.log(`Search Provider: ${results.searchProvider}`);
      console.log(`Total Results: ${results.totalResults}`);
      console.log(`First result: ${results.results?.[0]?.title}`);
    } else {
      console.log('Unexpected response format:', JSON.stringify(searchData, null, 2));
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testMCPWebSearchServer();