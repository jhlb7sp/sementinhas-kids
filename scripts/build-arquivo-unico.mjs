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
const oldInitial="const initial=()=>({teachers:[],helpers:[],history:{},draft:null});";
const seededInitial="const initial=()=>({teachers:[t('Sâmia',[4,3,2,1],'DT'),t('Naide',[4,3,2,1],'DT'),t('Deise',[4,3,2,1],'DT'),t('Ana Paula',[1,2,3,4]),t('Cinthia',[4,1,3,2]),t('Jhenifer',[1,2,3,4]),t('Jorge',[3,4,2,1]),t('Matheus',[3,4,2,1]),t('Michele',[3,4,2,1],'DT'),t('Nathalia',[1,2,3,4]),t('Thais',[2,3,1,4]),t('Vanessa',[1,2,3,4]),t('Vivi',[4,3,2,1]),t('Miriam',[2,3,1,4],'D',false),t('Nawá',[2,3,1,4],'D',false)],helpers:[h('Adrielly',[1,2,3,4]),h('Arthur B',[3,2,1,4]),h('Arthur F',[3,2,1,4]),h('Brenda',[2,3,1,4]),h('Enzo',[3,2,1,4]),h('Felipe',[2,3,1,4],'DT'),h('Gabriela',[1,2,3,4]),h('Ivan',[2,3,1,4]),h('Kauan',[3,2,1,4]),h('Lorena',[1,2,3,4]),h('Milena',[1,2,3,4]),h('Rafaela',[1,2,3,4]),h('Catarina',[1,2,3,4]),h('Tita',[0,0,0,0],'T'),h('Robert',[2,3,1,4],'D',false)],history:{},draft:null});";
if(!html.includes(oldInitial))throw Error('Modelo de cadastro da versão atual não foi encontrado.');
html=html.replace(oldInitial,seededInitial);
html=html.replace(/<title>[^<]*<\/title>/,'<title>Sementinhas Kids — arquivo único offline</title>');
const notice='<div class="noprint" style="max-width:1160px;margin:10px auto;padding:10px 14px;border:1px solid #cee4c5;border-radius:10px;background:#f2faee;color:#2b572e;font-size:13px">🌱 <b>Versão offline para liderança.</b> A equipe inicial é uma referência para testes; revise as prioridades, disponibilidades e regras antes de publicar escalas. Os dados ficam no navegador deste computador, não dentro do arquivo HTML. Use <b>Dados e backup → Salvar backup JSON</b> para guardar ou transferir os cadastros.</div>';
html=html.replace('<main class="wrap">',notice+'<main class="wrap">');
if(cssFiles<1||jsFiles<8||/<script\s+defer\s+src=|<link\s+rel="stylesheet"\s+href=|src="src\/assets\//.test(html))throw Error('Há recursos externos não incorporados.');
const output=path.join(root,'Sementinhas_Kids_Offline_Arquivo_Unico.html');
fs.writeFileSync(output,html,'utf8');
console.log('Arquivo offline:',output,'Tamanho:',(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB','CSS:',cssFiles,'JS:',jsFiles);
