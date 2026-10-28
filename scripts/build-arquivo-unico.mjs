import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Este script só é usado na construção. O HTML final funciona offline, sem Node.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const img = name => fs.readFileSync(path.join(root,'src/assets',name)).toString('base64');
const logos = {
  'src/assets/logo-sementinha.png':img('logo-sementinha.png'),
  'src/assets/logo-igreja.png':img('logo-igreja.png'),
};
let cssFiles=0,jsFiles=0;
html=html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?\s*>/g,(all,file)=>{
  cssFiles++;
  const css=fs.readFileSync(path.join(root,file),'utf8').replace(/<\/style/gi,'<\\/style');
  return '<style>\n/* '+file+' incorporado */\n'+css+'\n</style>';
});
html=html.replace(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g,(all,file)=>{
  jsFiles++;
  const code=fs.readFileSync(path.join(root,file),'utf8').replace(/<\/script/gi,'<\\/script');
  return '<script>\n/* '+file+' incorporado */\n'+code+'\n</script>';
});
for(const [file,encoded] of Object.entries(logos))html=html.replaceAll('src="'+file+'"','src="data:image/png;base64,'+encoded+'"');
html=html.replace(/<title>[^<]*<\/title>/,'<title>Sementinhas Kids — arquivo único offline</title>');
const notice='<div class="noprint" style="max-width:1160px;margin:10px auto;padding:10px 14px;border:1px solid #cee4c5;border-radius:10px;background:#f2faee;color:#2b572e;font-size:13px">🌱 <b>Versão offline para testes.</b> Os dados ficam no navegador deste computador, não dentro do arquivo HTML. Use <b>Dados e backup → Salvar backup JSON</b> para guardar ou transferir os cadastros.</div>';
html=html.replace('<main class="wrap">',notice+'<main class="wrap">');
if(cssFiles<1||jsFiles<8||/<script\s+defer\s+src=|<link\s+rel="stylesheet"\s+href=|src="src\/assets\//.test(html))throw Error('Há recursos externos não incorporados.');
const output=path.join(root,'Sementinhas_Kids_Offline_Arquivo_Unico.html');
fs.writeFileSync(output,html,'utf8');
console.log('Arquivo offline:',output,'Tamanho:',(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB','CSS:',cssFiles,'JS:',jsFiles);
