(function(){
'use strict';
var API='https://ep-ctf.ep-ctf.workers.dev';
var KEY='ep_hack_v1',B=document.body,term,out,inp,hud,cnt,ps,vault=null,cwd='/',wasm=null,te=new TextEncoder(),td=new TextDecoder(),st=rd();
st.name=st.name||'';st.solved=st.solved||{};st.hints=st.hints||{};st.flags=st.flags||{};
var HINTS={1:'read the page the way a browser does, not the way a human does.',2:'polite crawlers check a certain file before they visit.',3:'not every picture is just a picture. use tools made for secrets.',4:'the terminal remembers. all three keys open the vault.'};
function rd(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return {};}}
function sv(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
function p(x,c){out.appendChild(el('div',c||'',x));out.scrollTop=out.scrollHeight;}
function n(){return Object.keys(st.solved).length;}
function upd(){if(cnt)cnt.textContent='FLAGS '+n()+'/4';}
function build(){
  if(term)return;
  term=el('div','ep-term');out=el('div','ep-out');var row=el('div','ep-row');
  ps=el('span','ep-ps','ep@root:~$');row.appendChild(ps);inp=el('input','ep-in');inp.spellcheck=false;inp.autocomplete='off';inp.autocapitalize='off';row.appendChild(inp);
  term.appendChild(out);term.appendChild(row);
  hud=el('div','ep-hud');cnt=el('span');hud.appendChild(cnt);
  [['submit',submitUI],['board',boardUI],['exit',leave]].forEach(function(b){var x=el('button','ep-btn',b[0]);x.onclick=b[1];hud.appendChild(x);});
  B.appendChild(term);B.appendChild(hud);upd();
  term.onclick=function(){inp.focus();};
  inp.onkeydown=function(e){if(e.key==='Enter'){var v=inp.value;inp.value='';p(ps.textContent+' '+v,'ep-cmd');run(v);}};
}

function setCwd(d){cwd=d;ps.textContent='ep@root:'+(d==='/'?'~':'~/vault')+'$';}
function b64(x){var b=atob(x),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
async function unlock(){
  var f=st.flags;if(!(f[1]&&f[2]&&f[3]))return 'locked';
  if(vault)return 'ok';
  try{
    var u=new Uint8Array(await (await fetch('hack/vault.bin')).arrayBuffer());
    var km=await crypto.subtle.importKey('raw',te.encode([f[1],f[2],f[3]].join('\n')),'PBKDF2',false,['deriveKey']);
    var k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:u.slice(0,16),iterations:600000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);
    var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:u.slice(16,28)},k,u.slice(28));
    vault=JSON.parse(td.decode(pt));return 'ok';
  }catch(e){return 'fail';}
}
async function crack(pw){
  if(!wasm){var f=vault['crackme.wasm'];wasm=(await WebAssembly.instantiate(b64(f.d),{})).instance.exports;}
  var b=te.encode(pw).slice(0,32),m=new Uint8Array(wasm.memory.buffer);m.set(b,wasm.inbuf());
  var n=wasm.run(b.length);return td.decode(m.slice(wasm.outbuf(),wasm.outbuf()+n));
}
var C={
  help:function(){p('commands: help ls cat cd whoami name <n> flags hint submit [flag] board clear exit  (and whatever you find in the vault)');},
  ls:function(){if(cwd==='/'){p('README.txt');p('vault/'+(vault?'':'   [LOCKED: needs keys 1-3]'));}else Object.keys(vault).forEach(function(k){p(k);});},
  cat:function(a){var f=cwd==='/vault'&&vault&&vault[a[0]];if(cwd==='/'&&a[0]==='README.txt')p('4 flags, format EP{...}. find them, then submit. scope: this page and this terminal only. do not attack the server.');else if(f)p(f.t==='text'?f.d:'binary file. use: download '+a[0]);else if(a[0])p('cat: '+a[0]+': no such file or permission denied','ep-err');},
  cd:function(a){var d=(a[0]||'').replace(/\/+$/,'');if(d===''||d==='..'||d==='~'){setCwd('/');return;}
    if(d!=='vault'){p('cd: no such directory','ep-err');return;}
    if(vault){setCwd('/vault');return;}
    if(!(st.flags[1]&&st.flags[2]&&st.flags[3])){p('vault: locked. submit flags 1-3 first.','ep-err');return;}
    p('decrypting vault (pbkdf2)...');
    return unlock().then(function(r){if(r==='ok'){setCwd('/vault');p('vault unlocked.','ep-ok');}else p('vault: decryption failed. are your keys right?','ep-err');});},
  download:function(a){var f=cwd==='/vault'&&vault&&vault[a[0]];if(!f){p('download: no such file','ep-err');return;}
    var u=f.t==='text'?te.encode(f.d):b64(f.d),l=el('a');l.href=URL.createObjectURL(new Blob([u]));l.download=a[0];l.click();p('saved '+a[0]);},
  './crackme':function(a){if(!vault||cwd!=='/vault'){p('./crackme: not found here','ep-err');return;}
    if(!a.length){p('usage: ./crackme <password>');return;}
    return crack(a.join(' ')).then(function(o){p(o,o.indexOf('EP{')===0?'ep-ok':'ep-err');});},
  whoami:function(){p(st.name||'guest');},
  name:function(a){var v=a.join(' ');if(/^[\w .-]{1,24}$/.test(v)){st.name=v;sv();p('hello, '+v);}else p('usage: name <1-24 chars: letters, digits, space . _ ->','ep-err');},
  flags:function(){[1,2,3,4].forEach(function(i){p('level '+i+': '+(st.solved[i]?'solved':'locked'));});},
  hint:function(){for(var i=1;i<=4;i++)if(!st.solved[i]){st.hints[i]=1;sv();p('hint (level '+i+'): '+HINTS[i]);return;}p('all flags solved.');},
  submit:function(a){a.length?send(st.name,a.join('')):submitUI();},
  board:function(){boardUI();},
  clear:function(){out.textContent='';},
  exit:function(){leave();},
  hack:function(){B.classList.contains('ep-hack')?p('already in.'):(p('[ OK ] access granted','ep-ok'),activate());},
  sudo:function(a){if(a[0]!=='su')p('nice try.');else B.classList.contains('ep-hack')?p('you are already root. or are you?'):(p('[ OK ] access granted','ep-ok'),activate());}
};
function run(v){var a=v.trim().split(/\s+/),c=(a.shift()||'').toLowerCase();if(!c)return;C.hasOwnProperty(c)?C[c](a):p(c+': command not found (try help)','ep-err');}
function send(name,flag){
  if(!/^[\w .-]{1,24}$/.test(name||'')){p('set a name first: name <you>','ep-err');return Promise.resolve();}
  if(!/^EP\{[\x21-\x7e]{1,180}\}$/.test(flag)){p('[-] not a valid flag format','ep-err');return Promise.resolve();}
  if(!API){p('[-] scoreboard backend not deployed yet','ep-err');return Promise.resolve();}
  return fetch(API+'/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:name,flag:flag,hints:st.hints})})
   .then(function(r){return r.json();}).then(function(d){
     if(d&&d.ok&&d.level){st.solved[d.level]=1;st.flags[d.level]=flag;sv();upd();p('[+] level '+d.level+' solved. well done, '+name,'ep-ok');if(st.solved[1]&&st.solved[2]&&st.solved[3])p('[!] 3 keys held. the vault stirs...','ep-ok');}
     else p('[-] wrong flag','ep-err');
   }).catch(function(){p('[-] network error','ep-err');});
}
function modal(title,node){
  var m=el('div','ep-modal'),b=el('div','ep-box');b.appendChild(el('h3','',title));b.appendChild(node);m.appendChild(b);
  function close(){m.remove();document.removeEventListener('keydown',esc);}
  function esc(e){if(e.key==='Escape')close();}
  m.onclick=function(e){if(e.target===m)close();};document.addEventListener('keydown',esc);B.appendChild(m);m.close=close;return m;
}
function submitUI(){
  var f=el('form'),a=el('input'),b=el('input'),s=el('button','ep-btn','submit');
  a.placeholder='your name';a.maxLength=24;a.value=st.name;b.placeholder='EP{...}';b.autocomplete='off';b.spellcheck=false;s.type='submit';
  f.appendChild(a);f.appendChild(b);f.appendChild(s);var m=modal('SUBMIT FLAG',f);
  f.onsubmit=function(e){e.preventDefault();if(/^[\w .-]{1,24}$/.test(a.value)){st.name=a.value;sv();}m.close();p('ep@root:~$ submit ...','ep-cmd');send(a.value,b.value.trim());};a.focus();
}
function boardUI(){
  var w=el('div'),t=el('div','ep-tabs'),l=el('div');w.appendChild(t);w.appendChild(l);var m=modal('LEADERBOARD',w),d=null;
  function show(i){l.textContent='';var o=el('ol'),r=(d&&d[i])||[];if(!r.length)l.appendChild(el('div','','no solvers yet.'));
    r.forEach(function(x){o.appendChild(el('li','',x.name+(x.hint?' (hint)':'')+'  '+(x.t?new Date(x.t).toLocaleDateString():'')));});l.appendChild(o);
    [].forEach.call(t.children,function(c,j){c.classList.toggle('on',j+1===i);});}
  [1,2,3,4].forEach(function(i){var x=el('button','ep-btn ep-tab','L'+i);x.onclick=function(){show(i);};t.appendChild(x);});
  if(!API){l.textContent='scoreboard backend not deployed yet.';return;}
  fetch(API+'/board').then(function(r){return r.json();}).then(function(j){d=j;show(1);}).catch(function(){l.textContent='could not load the board.';});
}
function confirmUI(){
  var w=el('div');w.appendChild(el('div','','ACCESS GRANTED.'));w.appendChild(el('div','','enter the mainframe? [y/n]'));
  var y=el('button','ep-btn','y'),no=el('button','ep-btn','n');w.appendChild(y);w.appendChild(no);
  var m=modal('> ep-sh',w);
  function k(e){if(e.key==='y'||e.key==='Enter'){done(true);}else if(e.key==='n')done(false);}
  function done(ok){document.removeEventListener('keydown',k);m.close();if(ok)activate();}
  y.onclick=function(){done(true);};no.onclick=function(){done(false);};document.addEventListener('keydown',k);
}
function activate(){
  build();B.classList.add('ep-hack');term.classList.add('open');
  if(!out.childNodes.length){['[ OK ] mounting /dev/ctf','[ OK ] 4 flags hidden','type help'].forEach(function(x,i){setTimeout(function(){p(x,'ep-ok');},i*250);});}
  inp.focus();
}
function leave(){B.classList.remove('ep-hack');if(term)term.classList.remove('open');}
function enter(ask){if(B.classList.contains('ep-hack'))return;ask?confirmUI():activate();}
function openConsole(){build();term.classList.add('open');if(!out.childNodes.length)p("ep-sh 0.1 - type 'help'");inp.focus();}
document.addEventListener('keydown',function(e){if(e.key==='`'&&term){e.preventDefault();term.classList.toggle('open');if(term.classList.contains('open'))inp.focus();}});
window.EPHack={enter:enter,openConsole:openConsole};
})();
