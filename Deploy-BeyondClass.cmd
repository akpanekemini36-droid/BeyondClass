@echo off
setlocal
cd /d "%~dp0"
echo BeyondClass publishing helper
echo Netlify project: beyondclassmath
echo Use this helper after your custom domain is connected.
echo Before publishing, set SITE_URL and INBOX_PASSWORD in Netlify.
echo Read SETUP-NETLIFY-AND-GOOGLE.md for the complete steps.
echo.
where node >nul 2>&1
if errorlevel 1 goto missingnode
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=13)?0:1)"
if errorlevel 1 goto missingnode
call npm ci
if errorlevel 1 goto failed
call npx --yes netlify-cli@27.12.1 login
if errorlevel 1 goto failed
call npx --yes netlify-cli@27.12.1 link --name beyondclassmath
if errorlevel 1 goto failed
call npx --yes netlify-cli@27.12.1 status
if errorlevel 1 goto failed
powershell -NoProfile -Command "if ((Read-Host 'Check the project above. Type PUBLISH to replace the live BeyondClass website') -cne 'PUBLISH') { exit 1 }"
if errorlevel 1 goto cancelled
call npx --yes netlify-cli@27.12.1 deploy --prod --context production
if errorlevel 1 goto failed
echo.
echo Publishing completed. Check your custom domain and private inbox.
pause
exit /b 0
:missingnode
echo Install Node.js 22.13 or newer from https://nodejs.org/ and try again.
pause
exit /b 1
:cancelled
echo Publishing cancelled. Your live site was not changed by this helper.
pause
exit /b 1
:failed
echo The last step failed. Keep this window open and review the message above.
echo If a deploy started, check its status in Netlify before trying again.
pause
exit /b 1
