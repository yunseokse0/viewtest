// Test script to check current proxy configuration
const fs = require('fs');
const path = require('path');

console.log('=== Current Proxy Configuration Test ===');

// Check .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('\.env.local content:');
    console.log(envContent);
    
    // Parse PROXY_LIST
    const proxyMatch = envContent.match(/PROXY_LIST=(.*)/);
    if (proxyMatch) {
        const proxyList = proxyMatch[1].trim();
        console.log(`\nPROXY_LIST value: "${proxyList}"`);
        console.log(`PROXY_LIST length: ${proxyList.length}`);
        console.log(`PROXY_LIST is empty: ${proxyList === ''}`);
    }
} else {
    console.log('\.env.local file not found');
}

// Check process.env
console.log('\n=== Process Environment ===');
console.log(`process.env.PROXY_LIST: "${process.env.PROXY_LIST || 'undefined'}"`);
console.log(`process.env.ALLOW_DIRECT_IF_NO_PROXY: "${process.env.ALLOW_DIRECT_IF_NO_PROXY || 'undefined'}"`);

// Check if there are any default proxies
const defaultProxies = [
    'http://user:pass@1.2.3.4:8080',
    'http://user:pass@2.2.2.2:8080',
    'http://user:pass@3.3.3.3:3128',
    'https://user:pass@4.4.4.4:443',
    'http://user:pass@11.22.33.44:8080'
];

console.log('\n=== Searching for default proxies in codebase ===');
const { execSync } = require('child_process');

try {
    const searchResult = execSync('grep -r "1\.2\.3\.4\|2\.2\.2\.2\|3\.3\.3\.3\|4\.4\.4\.4\|11\.22\.33\.44" . --exclude-dir=node_modules --exclude-dir=.git', { encoding: 'utf8' });
    console.log('Found references:');
    console.log(searchResult);
} catch (e) {
    console.log('No default proxy references found in codebase');
}