
// Reset proxy configuration in dashboard
document.addEventListener('DOMContentLoaded', function() {
    const proxyTextarea = document.getElementById('proxiesText');
    if (proxyTextarea) {
        proxyTextarea.value = ''; // Clear any existing proxies
        console.log('Dashboard proxy textarea cleared');
    }
});
