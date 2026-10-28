@echo off
setlocal
title UNIPLAST - Gestionnaire du projet
chcp 65001 >nul
set "UNIPLAST_NODE="
set "UNIPLAST_OPTION="
if /i "%~1"=="--no-open" set "UNIPLAST_OPTION=--no-open"
if /i "%~1"=="--check" set "UNIPLAST_OPTION=--check"
if /i "%~1"=="--menu-check" set "UNIPLAST_OPTION=--menu-check"
if /i "%~1"=="--menu-no-open" set "UNIPLAST_OPTION=--menu-no-open"
if /i "%~1"=="--diagnostic" set "UNIPLAST_OPTION=--diagnostic"
if /i "%~1"=="--build" set "UNIPLAST_OPTION=--build"
if /i "%~1"=="--prepare" set "UNIPLAST_OPTION=--prepare"

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
if defined UNIPLAST_OPTION exit /b %UNIPLAST_RESULT%
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
const openBrowser = option !== '--no-open' && option !== '--menu-no-open' && !checkOnly;
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

async function startStore() {
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
        console.log('UNIPLAST est deja ouvert : ' + url); localService?.close(); open(url); return { server: null, url };
      }
      continue;
    }
    server.once('close',()=>localService?.close());
    console.log('\nUNIPLAST est pret : ' + url);
    console.log('Gardez cette fenetre ouverte pendant l\'utilisation.');
    console.log('Pour arreter : fermez cette fenetre ou appuyez sur Ctrl+C.\n');
    console.log('Les donnees du magasin sont conservees dans .uniplast-data. Sauvegardez ce dossier.');
    open(url);
    return { server, url };
  }
  throw new Error('Les ports locaux 4173 a 4182 sont occupes. Fermez une ancienne fenetre UNIPLAST puis reessayez.');
}

// Project manager: installs and builds only after an explicit menu choice.
const { createInterface } = require('node:readline/promises');
const { spawnSync } = require('node:child_process');
process.chdir(__dirname);
let ownedServer = null;
let storeUrl = '';
let menuInput = null;
let activeChild = null;
let stopping = false;

function findBuild() {
  const built = path.join(__dirname, 'dist');
  if (fs.existsSync(path.join(built, 'index.html'))) return built;
  if (fs.existsSync(path.join(__dirname, 'index.html')) && fs.existsSync(path.join(__dirname, 'assets'))) return __dirname;
  return '';
}
function projectSettings() {
  const file = path.join(__dirname, 'package.json');
  if (!fs.existsSync(file)) throw new Error('Cette operation demande l\'archive complete du nouveau projet, avec package.json et les sources.');
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error('Le fichier package.json est invalide.'); }
  if (value.name !== 'uniplast-store') throw new Error('Ce gestionnaire est reserve au nouveau projet uniplast-store. Placez RUN.BAT dans son dossier.');
  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(value.packageManager || '');
  if (!match || !fs.existsSync(path.join(__dirname, 'pnpm-lock.yaml'))) throw new Error('Le fichier de verrouillage pnpm-lock.yaml ou la version pnpm du projet est absent. Reprenez l\'archive complete.');
  return { value, version: match[1] };
}
function buildEnvironment() {
  const env = { ...process.env, pnpm_config_pm_on_fail: 'ignore' };
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'Path';
  env[pathKey] = path.dirname(process.execPath) + path.delimiter + (env[pathKey] || '');
  return env;
}
function packageCommand(version) {
  const runtime = path.dirname(process.execPath);
  const candidates = [
    path.resolve(runtime, '../node_modules/pnpm/bin/pnpm.mjs'),
    path.resolve(runtime, '../node_modules/pnpm/bin/pnpm.cjs'),
    path.join(runtime, 'node_modules/pnpm/bin/pnpm.mjs'),
    path.join(runtime, 'node_modules/pnpm/bin/pnpm.cjs')
  ];
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'npm/node_modules/pnpm/bin/pnpm.mjs'));
    candidates.push(path.join(process.env.APPDATA, 'npm/node_modules/pnpm/bin/pnpm.cjs'));
  }
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const result = spawnSync(process.execPath, [candidate, '--version'], { encoding: 'utf8', timeout: 15000, windowsHide: true, env: buildEnvironment() });
    if (result.status === 0 && result.stdout.trim() === version) return { args: [candidate], description: 'pnpm ' + version };
  }
  const npm = [path.join(runtime, 'node_modules/npm/bin/npm-cli.js'), path.resolve(runtime, '../node_modules/npm/bin/npm-cli.js')].find(file => fs.existsSync(file));
  if (npm) return { args: [npm, 'exec', '--yes', '--package=pnpm@' + version, '--', 'pnpm'], description: 'pnpm ' + version + ' via npm (Internet si necessaire)' };
  throw new Error('Le gestionnaire de paquets est introuvable. Installez Node.js avec npm depuis nodejs.org, puis choisissez la preparation du nouveau PC.');
}
async function packageAction(command, args) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...command.args, ...args], {
      cwd: __dirname, stdio: 'inherit', windowsHide: true, env: buildEnvironment()
    });
    activeChild = child;
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (activeChild === child) activeChild = null;
      resolve(signal ? 1 : (code ?? 1));
    });
  });
  if (code !== 0) throw new Error('Operation interrompue ou en echec (code ' + code + '). Consultez les messages ci-dessus. Aucun succes n\'est annonce.');
}
function checkBuildNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) throw new Error('La preparation et la reconstruction demandent Node.js 22.18 ou plus recent. La boutique deja construite peut etre ouverte avec Node.js 18 ou plus recent.');
}
async function rebuild(prepare = false) {
  const { version, value } = projectSettings();
  checkBuildNode();
  const command = packageCommand(version);
  if (prepare) {
    console.log('\nPREPARATION DU NOUVEAU PC / CLE USB');
    console.log('Connexion Internet necessaire si les bibliotheques ne sont pas deja en cache.');
    console.log('Installation des versions du projet avec ' + command.description + '...\n');
    await packageAction(command, ['install', '--frozen-lockfile']);
    console.log('\nInstallation terminee et verifiee. Construction de la boutique...\n');
  } else {
    if (!fs.existsSync(path.join(__dirname, 'node_modules/vite/bin/vite.js')) || !fs.existsSync(path.join(__dirname, 'node_modules/typescript/bin/tsc'))) throw new Error('Les bibliotheques ne sont pas installees. Choisissez [3] Preparer un nouveau PC avant la reconstruction.');
    console.log('\nMISE A JOUR LOCALE — reconstruction avec ' + command.description + '\n');
  }
  if (typeof value.scripts?.build !== 'string') throw new Error('La commande de construction du projet est absente.');
  await packageAction(command, ['run', 'build']);
  if (!fs.existsSync(path.join(__dirname, 'dist/index.html'))) throw new Error('La construction n\'a pas produit dist/index.html. La version n\'est pas prete.');
  console.log('\nSUCCES : la version a jour est prete dans le dossier dist.');
  console.log('Quittez puis relancez RUN.BAT pour charger le serveur et l\'interface mis a jour.');
  console.log('Cette operation ne publie pas le site sur Internet.\n');
}
function folder() {
  const root = findBuild();
  if (!root) throw new Error('Aucune version prete. Choisissez [2] ou [3] dans l\'archive complete.');
  console.log('\nFichiers de la boutique locale : ' + root);
  console.log('Ce dossier contient l\'interface locale. La version Internet se construit avec build:web et un service de donnees configure.');
  console.log('Aucun ancien compte Netlify, mot de passe ou jeton de publication n\'est utilise.');
  const child = spawn('explorer.exe', [root], { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log('Ouvrez le dossier affiche ci-dessus avec l\'Explorateur Windows.'));
  child.unref();
}
function diagnostic() {
  console.log('\nVERIFICATION DU PROJET');
  console.log('Dossier : ' + __dirname);
  console.log('Node.js : ' + process.versions.node);
  console.log('Version prete : ' + (findBuild() || 'ABSENTE'));
  console.log('Sources et package.json : ' + (fs.existsSync(path.join(__dirname, 'package.json')) ? 'presents' : 'absents — archive de distribution uniquement'));
  console.log('Bibliotheques locales : ' + (fs.existsSync(path.join(__dirname, 'node_modules/vite/bin/vite.js')) ? 'presentes' : 'absentes — choix [3] pour les installer'));
  console.log('Fichier .env : ' + (fs.existsSync(path.join(__dirname, '.env')) ? 'present (contenu non affiche)' : 'absent (configuration par environnement egalement possible)'));
  console.log('Guide : ' + path.join(__dirname, 'README.md'));
  console.log('La base locale est conservee dans .uniplast-data. Sauvegardez ce dossier apres arret.');
  console.log('La reconstruction est necessaire apres un changement de code ou de configuration de connexion.\n');
}
function printMenu() {
  console.log('\n============================================================');
  console.log('             UNIPLAST — GESTIONNAIRE DU PROJET');
  console.log('============================================================');
  console.log('  [1] Ouvrir la boutique (version prete)');
  console.log('  [2] Mettre a jour la version locale (reconstruire)');
  console.log('  [3] Preparer un nouveau PC / une cle USB');
  console.log('  [4] Ouvrir les fichiers de la boutique locale');
  console.log('  [5] Verifier le projet / informations utiles');
  console.log('  [0] Quitter et arreter le serveur de cette fenetre');
  console.log('============================================================');
  if (ownedServer?.listening) console.log('  Boutique ouverte : ' + storeUrl);
}
async function stopOwned() {
  const server = ownedServer;
  ownedServer = null;
  if (server?.listening) {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    console.log('\nLe serveur local de cette fenetre est arrete.');
  }
}
async function launch() {
  if (ownedServer?.listening) { console.log('Boutique deja ouverte : ' + storeUrl); open(storeUrl); return; }
  const result = await startStore();
  if (result) { ownedServer = result.server; storeUrl = result.url; }
}
async function shutdown() {
  if (stopping) return;
  stopping = true;
  if (activeChild) activeChild.kill();
  await stopOwned();
  menuInput?.close();
}
process.once('SIGINT', () => { shutdown().finally(() => process.exit(0)); });
process.once('SIGTERM', () => { shutdown().finally(() => process.exit(0)); });

async function runManager() {
  const [major,minor]=process.versions.node.split('.').map(Number);
  if (major<22 || (major===22 && minor<18)) throw new Error('Node.js 22.18 ou plus recent est necessaire.');
  if (option === '--menu-check') { printMenu(); return; }
  if (option === '--diagnostic') { diagnostic(); return; }
  if (option === '--check') { await startStore(); return; }
  if (option === '--build') { await rebuild(); return; }
  if (option === '--prepare') { await rebuild(true); return; }
  if (option === '--no-open') { await launch(); return; }

  menuInput = createInterface({ input: process.stdin, output: process.stdout });
  menuInput.once('close', () => { if (!stopping) void shutdown(); });
  try {
    while (!stopping) {
      printMenu();
      let answer;
      try { answer = (await menuInput.question('Votre choix : ')).trim(); }
      catch { break; }
      if (answer === '0') break;
      try {
        if (answer === '1') await launch();
        else if (answer === '2') await rebuild();
        else if (answer === '3') await rebuild(true);
        else if (answer === '4') folder();
        else if (answer === '5') diagnostic();
        else console.log('\nChoix invalide. Utilisez 0, 1, 2, 3, 4 ou 5.');
      } catch (error) { console.error('\nECHEC : ' + error.message + '\n'); }
    }
  } finally { await shutdown(); }
}
runManager().catch(error => { console.error('\nUNIPLAST : ' + error.message); process.exitCode = 1; });
