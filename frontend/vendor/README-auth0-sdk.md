Place the Auth0 SPA SDK locally if external CDNs are blocked.

Steps:
1. Download (one of):
   - https://cdn.auth0.com/js/auth0-spa-js/2.5.3/auth0-spa-js.production.js
   - or: https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2.5.3/dist/auth0-spa-js.production.js
2. Save the file as:
   frontend/vendor/auth0/auth0-spa-js.production.js
3. Do NOT modify its contents.
4. Reload the site. The loader will attempt the local path after public CDNs.

Security tip: Verify the downloaded file integrity (hash) if possible before hosting it.

This file is only documentation; you still need to create the 'auth0' folder and add the script file inside it.