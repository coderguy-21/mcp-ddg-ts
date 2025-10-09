# Tests

This directory contains all test files for the MCP Web Search Server.

## Test Files

### Provider Architecture Tests
- `test-provider-refactor.mjs` - Main test for the refactored provider architecture
- `test-brave.mjs` - Specific tests for Brave Search provider
- `test-refactored.mjs` - General refactored functionality tests

### Legacy Test Files
The following test files were created during development and testing:
- `test-bing-fallback.js` - Tests for Bing fallback functionality
- `test-bing-query.js` - Bing search query tests
- `test-brave-preferred-sites.js` - Brave search with preferred sites
- `test-brave-search.js` - Basic Brave search tests
- `test-clean-bing.js` - Clean Bing search tests
- `test-fallback.js` - General fallback tests
- `test-intelligent-requests.js` - Request management tests
- `test-mcp-server.js` - MCP server functionality tests
- `test-preferred-sites.js` - Preferred sites functionality tests
- `test-rate-limit-status.js` - Rate limiting detection tests
- `test-simple.js` - Simple search tests
- `test-suspension.js` - Provider suspension tests
- `test.js` - Basic functionality tests

## Running Tests

Use the npm scripts to run tests:

```bash
# Run the main provider architecture test
npm test

# Run specific test suites
npm run test:providers    # Provider architecture tests
npm run test:brave       # Brave provider tests
npm run test:refactored  # Refactored functionality tests
```

## Test Structure

The main test file (`test-provider-refactor.mjs`) tests:

1. **Individual Providers**: Tests each search provider (DuckDuckGo, Brave) independently
2. **Main Search Tool**: Tests the orchestration logic with provider selection and fallback
3. **Provider Integration**: Verifies that the refactored architecture maintains all functionality

All tests use debug mode to provide detailed output about:
- Search URLs being called
- Request management and rate limiting
- Provider selection logic
- Result parsing and formatting
- Enhanced query generation with preferred sites