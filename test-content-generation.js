const axios = require('axios');

async function testContentGeneration() {
  try {
    console.log('🚀 Testing Content Generation with Media...\n');

    // Test environment variables
    console.log('📋 Environment Variables:');
    console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅ Set' : '❌ Missing');
    console.log('GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID ? '✅ Set' : '❌ Missing');
    console.log('GOOGLE_CLOUD_LOCATION:', process.env.GOOGLE_CLOUD_LOCATION ? '✅ Set' : '❌ Missing');
    console.log('MEDIA_STORAGE_PATH:', process.env.MEDIA_STORAGE_PATH ? '✅ Set' : '❌ Missing');
    console.log('');

    // Wait for server to start
    console.log('⏳ Waiting for server to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test server health
    try {
      const healthResponse = await axios.get('http://localhost:3000');
      console.log('✅ Server is running');
    } catch (error) {
      console.log('❌ Server is not responding:', error.message);
      return;
    }

    // Test content generation endpoint (you'll need to provide actual account/schedule IDs)
    console.log('\n🎯 Testing Content Generation...');
    console.log('Note: You need to provide valid accountId and scheduleId to test actual content generation');
    console.log('The endpoint is: POST /ai/generate-content');
    console.log('Required body: { accountId: number, scheduleId: number, generationWeek: string }');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Load environment variables
require('dotenv').config();

testContentGeneration();
