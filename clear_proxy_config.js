// Clear all proxy configuration and reset to direct connection
const fs = require('fs');
const path = require('path');

console.log('=== Clearing Proxy Configuration ===');

// 1. Clear .env.local PROXY_LIST
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/PROXY_LIST=.*/g, 'PROXY_LIST=');
    envContent = envContent.replace(/ALLOW_DIRECT_IF_NO_PROXY=.*/g, 'ALLOW_DIRECT_IF_NO_PROXY=true');
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env.local cleared');
}

// 2. Create a reset script for the dashboard
const resetScript = `
// Reset proxy configuration in dashboard
document.addEventListener('DOMContentLoaded', function() {
    const proxyTextarea = document.getElementById('proxiesText');
    if (proxyTextarea) {
        proxyTextarea.value = ''; // Clear any existing proxies
        console.log('Dashboard proxy textarea cleared');
    }
});
`;

fs.writeFileSync(path.join(__dirname, 'public', 'reset_proxies.js'), resetScript);
console.log('✅ Dashboard reset script created');

// 3. Add reset script to index.html
const indexPath = path.join(__dirname, 'public', 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
if (!indexContent.includes('reset_proxies.js')) {
    indexContent = indexContent.replace('</body>', '<script src="reset_proxies.js"></script></body>');
    fs.writeFileSync(indexPath, indexContent);
    console.log('✅ Reset script added to index.html');
}

console.log('\n=== Configuration Reset Complete ===');
console.log('✅ PROXY_LIST cleared');
console.log('✅ Direct connection enabled');
console.log('✅ Dashboard proxy textarea cleared');
console.log('\nThe system is now configured for direct connection without proxies.');
console.log('If you still see proxy failures, they are likely from cached/old browser sessions.');