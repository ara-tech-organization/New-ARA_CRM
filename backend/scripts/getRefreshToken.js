import { google } from 'googleapis';
import { createServer } from 'http';
import { parse } from 'url';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config();

// OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_ADS_CLIENT_ID,
  process.env.GOOGLE_ADS_CLIENT_SECRET,
  'http://localhost:3000/oauth2callback'
);

// Generate the authorization URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/adwords'],
  prompt: 'consent'
});

console.log('🔗 Open this URL in your browser:');
console.log(authUrl);
console.log('\n📋 Instructions:');
console.log('1. Click the link above');
console.log('2. Sign in with your Google Ads account');
console.log('3. Grant permission');
console.log('4. Copy the authorization code from the URL');

// Create a simple HTTP server to receive the callback
const server = createServer(async (req, res) => {
  const url = parse(req.url, true);
  const code = url.query.code;

  if (code) {
    try {
      // Exchange the code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      console.log('\n🎉 Success! Your refresh token is:');
      console.log(tokens.refresh_token);
      console.log('\n📝 Add this to your .env file:');
      console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1>Success!</h1>
        <p>Check your terminal for the refresh token.</p>
        <p>You can close this window now.</p>
      `);

      server.close();
      process.exit(0);
    } catch (error) {
      console.error('Error getting tokens:', error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error</h1><p>${error.message}</p>`);
    }
  } else {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>No code received</h1>');
  }
});

// Start the server
server.listen(3000, () => {
  console.log('🌐 Local server started on http://localhost:3000');
  console.log('⏳ Waiting for authorization...');

  // Auto-open the browser (optional)
  open(authUrl).catch(() => {
    console.log('📱 Please manually open the URL above in your browser');
  });
});