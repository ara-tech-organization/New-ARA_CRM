import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔑 Google Ads OAuth Setup');
console.log('==========================\n');

// Your current credentials
console.log('📋 Your Current Credentials:');
console.log(`Client ID: ${process.env.GOOGLE_ADS_CLIENT_ID}`);
console.log(`Client Secret: ${process.env.GOOGLE_ADS_CLIENT_SECRET?.substring(0, 10)}...`);
console.log(`Developer Token: ${process.env.GOOGLE_ADS_DEVELOPER_TOKEN}`);
console.log('');

console.log('🚨 IMPORTANT: You need to get a refresh token that matches these exact credentials!');
console.log('');

console.log('📝 Step-by-Step Instructions:');
console.log('1. Go to: https://developers.google.com/oauthplayground/');
console.log('2. Click the ⚙️ gear icon (top right)');
console.log('3. Enter these exact values:');
console.log(`   - Client ID: ${process.env.GOOGLE_ADS_CLIENT_ID}`);
console.log(`   - Client Secret: ${process.env.GOOGLE_ADS_CLIENT_SECRET}`);
console.log('4. Click "Close"');
console.log('5. On the left sidebar, find and select: "Google Ads API"');
console.log('6. Select this scope: https://www.googleapis.com/auth/adwords');
console.log('7. Click "Authorize APIs"');
console.log('8. Sign in with your Google Ads account');
console.log('9. Grant permission');
console.log('10. Click "Exchange authorization code for tokens"');
console.log('11. COPY the "refresh_token" value');
console.log('');

console.log('🔄 Then update your .env file:');
console.log('GOOGLE_ADS_REFRESH_TOKEN=your_new_refresh_token_here');
console.log('');

console.log('✅ Why this method works:');
console.log('- Uses the official Google OAuth Playground');
console.log('- Matches your exact client credentials');
console.log('- Generates a proper refresh token for Google Ads API');
console.log('');

console.log('🎯 After updating .env, run: npm run test:google-ads');