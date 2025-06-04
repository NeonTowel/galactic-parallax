#!/usr/bin/env node

/**
 * Simple caching test script for Galactic Parallax API
 * 
 * This script demonstrates the caching functionality by:
 * 1. Making initial API calls (cache miss)
 * 2. Making repeated calls (cache hit)
 * 3. Measuring response times
 * 4. Showing cache statistics
 */

const API_BASE = process.env.API_BASE || 'http://localhost:8787';
const JWT_TOKEN = process.env.JWT_TOKEN;

if (!JWT_TOKEN) {
  console.error('❌ JWT_TOKEN environment variable is required');
  console.log('Usage: JWT_TOKEN=your_token node test-caching.js');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json'
};

async function makeRequest(url, description) {
  const start = Date.now();
  
  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    const duration = Date.now() - start;
    
    return {
      success: response.ok,
      data,
      duration,
      description
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - start,
      description
    };
  }
}

async function testSearchCaching() {
  console.log('\n🔍 Testing Search Endpoint Caching');
  console.log('=====================================');
  
  const searchUrl = `${API_BASE}/api/search/images?q=nature%20landscape&count=5`;
  
  // First request (cache miss)
  console.log('\n1️⃣ First request (expected cache miss):');
  const result1 = await makeRequest(searchUrl, 'Search - Cache Miss');
  
  if (result1.success) {
    console.log(`   ✅ Response time: ${result1.duration}ms`);
    console.log(`   📊 Cached: ${result1.data.cached || false}`);
    console.log(`   🔑 Cache key: ${result1.data.cacheKey || 'none'}`);
    console.log(`   📝 Results: ${result1.data.data?.items?.length || 0} items`);
  } else {
    console.log(`   ❌ Error: ${result1.error || result1.data?.error}`);
    return;
  }
  
  // Second request (cache hit)
  console.log('\n2️⃣ Second request (expected cache hit):');
  const result2 = await makeRequest(searchUrl, 'Search - Cache Hit');
  
  if (result2.success) {
    console.log(`   ✅ Response time: ${result2.duration}ms`);
    console.log(`   📊 Cached: ${result2.data.cached || false}`);
    console.log(`   🔑 Cache key: ${result2.data.cacheKey || 'none'}`);
    console.log(`   📝 Results: ${result2.data.data?.items?.length || 0} items`);
    
    // Performance comparison
    const improvement = ((result1.duration - result2.duration) / result1.duration * 100).toFixed(1);
    console.log(`   🚀 Performance improvement: ${improvement}% faster`);
  } else {
    console.log(`   ❌ Error: ${result2.error || result2.data?.error}`);
  }
}

async function testPaginationCaching() {
  console.log('\n📄 Testing Pagination Caching');
  console.log('==============================');
  
  const baseQuery = 'nature%20landscape';
  
  // Test Page 1 (start=1)
  console.log('\n1️⃣ Page 1 (start=1, count=5):');
  const page1Url = `${API_BASE}/api/search/images?q=${baseQuery}&count=5&start=1`;
  const page1Result1 = await makeRequest(page1Url, 'Page 1 - First Request');
  
  if (page1Result1.success) {
    console.log(`   ✅ Response time: ${page1Result1.duration}ms`);
    console.log(`   📊 Cached: ${page1Result1.data.cached || false}`);
    console.log(`   📝 Results: ${page1Result1.data.data?.items?.length || 0} items`);
  } else {
    console.log(`   ❌ Error: ${page1Result1.error || page1Result1.data?.error}`);
    return;
  }
  
  // Test Page 2 (start=6)
  console.log('\n2️⃣ Page 2 (start=6, count=5):');
  const page2Url = `${API_BASE}/api/search/images?q=${baseQuery}&count=5&start=6`;
  const page2Result1 = await makeRequest(page2Url, 'Page 2 - First Request');
  
  if (page2Result1.success) {
    console.log(`   ✅ Response time: ${page2Result1.duration}ms`);
    console.log(`   📊 Cached: ${page2Result1.data.cached || false}`);
    console.log(`   📝 Results: ${page2Result1.data.data?.items?.length || 0} items`);
  } else {
    console.log(`   ❌ Error: ${page2Result1.error || page2Result1.data?.error}`);
    return;
  }
  
  // Test Page 1 again (should be cached)
  console.log('\n🔄 Back to Page 1 (should be cached):');
  const page1Result2 = await makeRequest(page1Url, 'Page 1 - Second Request');
  
  if (page1Result2.success) {
    console.log(`   ✅ Response time: ${page1Result2.duration}ms`);
    console.log(`   📊 Cached: ${page1Result2.data.cached || false}`);
    console.log(`   📝 Results: ${page1Result2.data.data?.items?.length || 0} items`);
    
    if (page1Result2.data.cached) {
      const improvement = ((page1Result1.duration - page1Result2.duration) / page1Result1.duration * 100).toFixed(1);
      console.log(`   🚀 Cache performance: ${improvement}% faster`);
    }
  } else {
    console.log(`   ❌ Error: ${page1Result2.error || page1Result2.data?.error}`);
  }
  
  // Test Page 2 again (should be cached)
  console.log('\n🔄 Back to Page 2 (should be cached):');
  const page2Result2 = await makeRequest(page2Url, 'Page 2 - Second Request');
  
  if (page2Result2.success) {
    console.log(`   ✅ Response time: ${page2Result2.duration}ms`);
    console.log(`   📊 Cached: ${page2Result2.data.cached || false}`);
    console.log(`   📝 Results: ${page2Result2.data.data?.items?.length || 0} items`);
    
    if (page2Result2.data.cached) {
      const improvement = ((page2Result1.duration - page2Result2.duration) / page2Result1.duration * 100).toFixed(1);
      console.log(`   🚀 Cache performance: ${improvement}% faster`);
    }
  } else {
    console.log(`   ❌ Error: ${page2Result2.error || page2Result2.data?.error}`);
  }
  
  console.log('\n💡 Pagination Summary:');
  console.log('   • Each page gets its own cache entry');
  console.log('   • Users can navigate between cached pages instantly');
  console.log('   • Only new pages trigger Google API calls');
  console.log('   • Perfect for browsing large result sets');
}

async function testSuggestionsCaching() {
  console.log('\n💡 Testing Suggestions Endpoint Caching');
  console.log('=========================================');
  
  const suggestionsUrl = `${API_BASE}/api/search/suggestions?category=landscape`;
  
  // First request
  console.log('\n1️⃣ First request:');
  const result1 = await makeRequest(suggestionsUrl, 'Suggestions - First');
  
  if (result1.success) {
    console.log(`   ✅ Response time: ${result1.duration}ms`);
    console.log(`   📊 Cached: ${result1.data.cached || false}`);
    console.log(`   📝 Suggestions: ${result1.data.data?.suggestions?.length || 0} items`);
  } else {
    console.log(`   ❌ Error: ${result1.error || result1.data?.error}`);
    return;
  }
  
  // Second request
  console.log('\n2️⃣ Second request:');
  const result2 = await makeRequest(suggestionsUrl, 'Suggestions - Second');
  
  if (result2.success) {
    console.log(`   ✅ Response time: ${result2.duration}ms`);
    console.log(`   📊 Cached: ${result2.data.cached || false}`);
    console.log(`   📝 Suggestions: ${result2.data.data?.suggestions?.length || 0} items`);
  } else {
    console.log(`   ❌ Error: ${result2.error || result2.data?.error}`);
  }
}

async function testHealthCheckCaching() {
  console.log('\n🏥 Testing Health Check Caching');
  console.log('================================');
  
  const healthUrl = `${API_BASE}/api/search/health`;
  
  // First request
  const result1 = await makeRequest(healthUrl, 'Health - First');
  
  if (result1.success) {
    console.log(`   ✅ Response time: ${result1.duration}ms`);
    console.log(`   📊 Cached: ${result1.data.cached || false}`);
    console.log(`   🏥 Healthy: ${result1.data.data?.healthy || false}`);
  } else {
    console.log(`   ❌ Error: ${result1.error || result1.data?.error}`);
    return;
  }
  
  // Second request
  const result2 = await makeRequest(healthUrl, 'Health - Second');
  
  if (result2.success) {
    console.log(`   ✅ Response time: ${result2.duration}ms`);
    console.log(`   📊 Cached: ${result2.data.cached || false}`);
    console.log(`   🏥 Healthy: ${result2.data.data?.healthy || false}`);
  } else {
    console.log(`   ❌ Error: ${result2.error || result2.data?.error}`);
  }
}

async function getCacheStats() {
  console.log('\n📊 Cache Statistics');
  console.log('===================');
  
  const statsUrl = `${API_BASE}/api/search/cache/stats`;
  const result = await makeRequest(statsUrl, 'Cache Stats');
  
  if (result.success) {
    console.log(`   📦 Cache size: ${result.data.data?.size || 0} entries`);
    console.log(`   🔑 Cache keys:`);
    
    const keys = result.data.data?.keys || [];
    keys.forEach((key, index) => {
      console.log(`      ${index + 1}. ${key}`);
    });
    
    if (keys.length === 0) {
      console.log('      (no cache entries)');
    }
  } else {
    console.log(`   ❌ Error: ${result.error || result.data?.error}`);
  }
}

async function clearCache() {
  console.log('\n🧹 Clearing Cache');
  console.log('==================');
  
  const clearUrl = `${API_BASE}/api/search/cache`;
  
  try {
    const response = await fetch(clearUrl, {
      method: 'DELETE',
      headers
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ ${data.message}`);
    } else {
      console.log(`   ❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Galactic Parallax API - Caching Test Suite');
  console.log('===============================================');
  console.log(`🌐 API Base: ${API_BASE}`);
  console.log(`🔐 Using JWT authentication`);
  
  try {
    // Clear cache first
    await clearCache();
    
    // Test different endpoints
    await testSearchCaching();
    await testPaginationCaching();
    await testSuggestionsCaching();
    await testHealthCheckCaching();
    
    // Show final cache stats
    await getCacheStats();
    
    console.log('\n✅ Caching tests completed!');
    console.log('\n💡 Key Observations:');
    console.log('   • First requests should show cached: false');
    console.log('   • Subsequent requests should show cached: true');
    console.log('   • Cached responses should be significantly faster');
    console.log('   • Cache keys should be consistent for identical requests');
    console.log('   • Each pagination page gets its own cache entry');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests(); 