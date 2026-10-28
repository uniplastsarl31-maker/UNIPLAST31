@echo off
setlocal
title UNIPLAST - Demarrage
chcp 65001 >nul
set "UNIPLAST_NODE="
set "UNIPLAST_OPTION="
if /i "%~1"=="--no-open" set "UNIPLAST_OPTION=--no-open"
if /i "%~1"=="--check" set "UNIPLAST_OPTION=--check"

if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "UNIPLAST_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined UNIPLAST_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "UNIPLAST_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined UNIPLAST_NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "UNIPLAST_NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined UNIPLAST_NODE for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do if not defined UNIPLAST_NODE set "UNIPLAST_NODE=%%N"

if not defined UNIPLAST_NODE goto node_missing
"%UNIPLAST_NODE%" -e "const fs=require('node:fs'),p=require('node:path'),f=process.argv[1],s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),m='\n//--UNIPLAST-SERVER--\n',i=s.indexOf(m);if(i<0)throw new Error('Lanceur incomplet');new Function('require','__filename','__dirname',s.slice(i+m.length))(require,f,p.dirname(f));" "%~f0" %UNIPLAST_OPTION%
set "UNIPLAST_RESULT=%ERRORLEVEL%"
if not "%UNIPLAST_RESULT%"=="0" goto launch_failed
exit /b 0

:node_missing
echo.
echo Node.js est introuvable sur cet ordinateur.
echo Installez Node.js depuis https://nodejs.org/ puis relancez ce fichier.
echo Aucune installation avec droits administrateur n'est lancee automatiquement.
if /i "%UNIPLAST_OPTION%"=="--check" exit /b 1
pause
exit /b 1

:launch_failed
echo.
echo Le demarrage a echoue. Consultez le message ci-dessus.
if /i "%UNIPLAST_OPTION%"=="--check" exit /b %UNIPLAST_RESULT%
if /i "%UNIPLAST_OPTION%"=="--no-open" exit /b %UNIPLAST_RESULT%
pause
exit /b %UNIPLAST_RESULT%

//--UNIPLAST-SERVER--
// This self-contained section is executed by Node.js, after the batch exits.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const option = process.argv[2] || '';
const checkOnly = option === '--check';
const openBrowser = option !== '--no-open' && !checkOnly;
const host = '127.0.0.1';
const installation = crypto.createHash('sha256').update(path.resolve(__dirname).toLowerCase()).digest('hex').slice(0, 24);
const statusPath = '/__uniplast_launcher_status';
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8'
};

function inside(root, file) {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function open(url) {
  if (!openBrowser) return;
  // A fixed loopback URL is passed as an argument, without a command shell.
  const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    windowsHide: true, stdio: 'ignore'
  });
  child.on('error', () => console.log('Ouvrez cette adresse dans votre navigateur : ' + url));
  child.unref();
}
function textResponse(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(message);
}
async function sameInstance(port) {
  return new Promise(resolve => {
    let complete = false;
    const done = value => { if (!complete) { complete = true; resolve(value); } };
    const req = http.get({ hostname: host, port, path: statusPath, timeout: 1000 }, res => {
      if (res.statusCode !== 200) { res.resume(); done(false); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', data => { body += data; if (body.length > 2048) { req.destroy(); done(false); } });
      res.on('error', () => done(false));
      res.on('end', () => {
        try { const value = JSON.parse(body); done(value.app === 'uniplast-local' && value.installation === installation); }
        catch { done(false); }
      });
    });
    req.on('timeout', () => { req.destroy(); done(false); });
    req.on('error', () => done(false));
  });
}

async function main() {
  const [nodeMajor,nodeMinor]=process.versions.node.split('.').map(Number);
  if (nodeMajor < 22 || (nodeMajor===22 && nodeMinor<18)) throw new Error('Node.js 22.18 ou plus recent est necessaire pour ce lanceur.');
  const builtFolder = path.join(__dirname, 'dist');
  let root;
  if (fs.existsSync(path.join(builtFolder, 'index.html'))) root = builtFolder;
  else if (fs.existsSync(path.join(__dirname, 'index.html')) && fs.existsSync(path.join(__dirname, 'assets'))) root = __dirname;
  else throw new Error('Version prete a demarrer introuvable. Extrayez toute l\'archive du programme : le dossier dist doit rester a cote de ce fichier BAT.');
  root = await fs.promises.realpath(root);
  const indexHtml = await fs.promises.readFile(path.join(root, 'index.html'), 'utf8');
  if (/\/src\/(main|index)\.[jt]sx?/.test(indexHtml)) throw new Error('Ce dossier contient les sources. Utilisez le dossier dist de l\'archive complete ou reconstruisez le projet.');
  if(!fs.existsSync(path.join(__dirname,'server','local-store.cjs')) || !fs.existsSync(path.join(__dirname,'server','generated','seed.json'))) throw new Error('Le dossier server est absent ou incomplet. Extrayez toute la nouvelle archive UNIPLAST a cote du lanceur.');
  if (checkOnly) {
    console.log('UNIPLAST : lanceur valide, Node.js ' + process.versions.node + ', version prete trouvee.');
    console.log('Dossier utilise : ' + root);
    return;
  }

  let localService;
  const localFile=path.join(__dirname,'server','local-store.cjs');
  if(fs.existsSync(localFile)) localService=require(localFile).createLocalStore();
  const handle = async (req, res) => {
    if(localService && await localService.handle(req,res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD'); textResponse(res, 405, 'Methode non autorisee.'); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://' + host).pathname); }
    catch { textResponse(res, 400, 'Adresse invalide.'); return; }
    if (pathname.includes('\\') || pathname.includes('\0')) { textResponse(res, 400, 'Adresse invalide.'); return; }
    if (pathname === statusPath) {
      const body = JSON.stringify({ app: 'uniplast-local', installation });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    if(pathname !== '/' && pathname !== '/index.html' && !pathname.startsWith('/assets/')) { textResponse(res,404,'Fichier introuvable.'); return; }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!inside(root, file) || !mime[path.extname(file).toLowerCase()]) { textResponse(res, 404, 'Fichier introuvable.'); return; }
    try {
      const realFile = await fs.promises.realpath(file);
      if(realFile !== path.join(root,'index.html') && !inside(path.join(root,'assets'),realFile)) { textResponse(res,404,'Fichier introuvable.'); return; }
      if (!inside(root, realFile) || !(await fs.promises.stat(realFile)).isFile()) { textResponse(res, 404, 'Fichier introuvable.'); return; }
      const body = await fs.promises.readFile(realFile);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file).toLowerCase()], 'Content-Length': body.length,
        'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()'
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      textResponse(res, error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, 'Fichier inaccessible.');
    }
  };

  for (let port = 4173; port < 4183; port++) {
    const server = http.createServer((req, res) => { handle(req, res).catch(() => { if (!res.headersSent) textResponse(res, 500, 'Erreur locale.'); else res.destroy(); }); });
    const error = await new Promise(resolve => {
      const failed = error => resolve(error);
      server.once('error', failed);
      server.listen({ host, port }, () => { server.removeListener('error', failed); resolve(null); });
    });
    const url = 'http://' + host + ':' + port + '/';
    if (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      if (await sameInstance(port)) {
        console.log('UNIPLAST est deja ouvert : ' + url); localService?.close(); open(url); return;
      }
      continue;
    }
    server.once('close',()=>localService?.close());
    console.log('\nUNIPLAST est pret : ' + url);
    console.log('Gardez cette fenetre ouverte pendant l\'utilisation.');
    console.log('Pour arreter : fermez cette fenetre ou appuyez sur Ctrl+C.\n');
    console.log('Les donnees du magasin sont conservees dans .uniplast-data. Sauvegardez ce dossier.');
    open(url);
    let closing = false;
    const stop = () => { if (!closing) { closing = true; server.close(() => process.exit(0)); server.closeAllConnections(); } };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    return;
  }
  throw new Error('Les ports locaux 4173 a 4182 sont occupes. Fermez une ancienne fenetre UNIPLAST puis reessayez.');
}
main().catch(error => { console.error('\nUNIPLAST : ' + error.message); process.exitCode = 1; });
