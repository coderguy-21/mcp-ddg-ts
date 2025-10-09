import { BraveProvider } from './dist/providers/brave-provider.js';

async function testBraveProvider() {
  console.log('Testing Brave provider directly...\n');
  
  const braveProvider = new BraveProvider(true); // Enable debug mode
  
  try {
    const results = await braveProvider.search("TypeScript best practices", 3);
    
    console.log(`Found ${results.length} results from Brave:`, '\n');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Summary: ${result.summary}`);
      console.log(`   Keywords: ${result.keywords.join(', ')}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Brave search failed:', error.message);
  }
}

testBraveProvider();