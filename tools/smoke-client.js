// Simulate a browser loading Pixel Planes: stub DOM/canvas, concatenate the
// client scripts in index.html order, run them, then DRIVE the online client
// path (join -> see others -> shoot -> get hit -> die -> respawn -> score) to
// confirm the V1-V4 client code runs without throwing.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = require('path').join(__dirname, '..');

const noop = () => {};
const gradient = { addColorStop: noop };
const ctx = new Proxy({}, { get: (t, p) => {
  if (p === 'canvas') return { width: 960, height: 540 };
  if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createConicGradient' || p === 'createPattern') return () => gradient;
  if (p === 'measureText') return () => ({ width: 0 });
  if (p === 'getImageData') return () => ({ data: [] });
  return () => {};
}, set: () => true });
function el() {
  return { style:{}, value:'', textContent:'', innerHTML:'', className:'', width:960, height:540,
    addEventListener:noop, removeEventListener:noop, appendChild:noop, removeChild:noop, setAttribute:noop,
    getAttribute:()=>null, focus:noop, blur:noop, classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
    getContext:()=>ctx, getBoundingClientRect:()=>({left:0,top:0,width:960,height:540}), querySelector:()=>el(), querySelectorAll:()=>[] };
}
const store = {};
const sandbox = {
  console, Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite, Array, Object, String, Number, Boolean, Set, Map,
  setTimeout:()=>0, clearTimeout:noop, setInterval:()=>0, clearInterval:noop,
  requestAnimationFrame:noop, cancelAnimationFrame:noop, performance:{ now:()=>0 },
  localStorage:{ getItem:(k)=>store[k]||null, setItem:(k,v)=>{store[k]=''+v;}, removeItem:(k)=>{delete store[k];} },
  location:{ protocol:'http:', host:'localhost:8080', hostname:'localhost', href:'http://localhost:8080/' },
  navigator:{ userAgent:'node', maxTouchPoints:0 },
  WebSocket: class { constructor(){ this.readyState=0; } send(){} close(){} addEventListener(){} },
  Image: class { set src(v){} },
  AudioContext: class { createOscillator(){return {connect:noop,start:noop,stop:noop,frequency:{value:0,setValueAtTime:noop}};} createGain(){return {connect:noop,gain:{value:0,setValueAtTime:noop,linearRampToValueAtTime:noop,exponentialRampToValueAtTime:noop}};} get destination(){return {};} get currentTime(){return 0;} resume(){} },
  addEventListener:noop, removeEventListener:noop, matchMedia:()=>({matches:false,addEventListener:noop,addListener:noop}),
  getComputedStyle:()=>({}), alert:noop, prompt:()=>null, confirm:()=>false,
  fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.webkitAudioContext = sandbox.AudioContext;
sandbox.document = { getElementById:()=>el(), createElement:()=>el(), querySelector:()=>el(), querySelectorAll:()=>[],
  addEventListener:noop, removeEventListener:noop, body:el(), documentElement:el(), getElementsByClassName:()=>[], getElementsByTagName:()=>[] };

const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const files = [...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
console.log('Loading', files.length, 'scripts in page order...');
const code = files.map(f => '\n// ===== '+f+' =====\n' + fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n');

// Driver runs INSIDE the same script (so const Net/Input/player are in scope).
const DRIVER = `
;(function(){
  const log=(m)=>console.log("  [online] "+m);
  Net.myId=1; Net.username="Tester";
  Net.onWelcome();
  log("V1 welcomed -> playerState="+playerState+" gameStarted="+gameStarted+" mode="+mode);
  Net.onSnapshot([
    {id:2,name:"Foe",x:player.x+30,y:player.y,angle:Math.PI,vx:0,vy:0,health:10,alive:true,score:5},
    {id:1000001,name:"Sam",x:player.x+60,y:player.y,angle:0,vx:0,vy:0,health:10,alive:true,score:2}
  ]);
  log("V2 snapshot -> remote planes="+Object.keys(remotePlayers).length+" (expect 2)");
  Input.fire=true;
  for(let i=0;i<6;i++){ update(); draw(); }
  log("flew 6 frames shooting; bullets in flight="+bullets.length);
  Net.onFire(2,"gun",player.x+10,player.y,0);
  Net.onFire(1000001,"missile",player.x+10,player.y,0);
  for(let i=0;i<3;i++){ update(); draw(); }
  log("V2 others firing rendered; missiles="+missiles.length);
  Net.onHit(2,"gun");           // a hit DURING spawn protection should do nothing
  log("V4 shielded hit: health="+player.health+" (expect still 10)");
  player.invincibleTimer = 0;   // expire spawn protection so the test kill lands
  const before=player.health;
  for(let i=0;i<12;i++) Net.onHit(2,"gun");
  log("V4 took fire: health "+before+" -> "+player.health+"; playerState="+playerState);
  Net.onDown(1000001,1);
  log("V4 you scored a kill -> score="+score);
  for(let i=0;i<120;i++){ update(); draw(); }
  log("V4 after respawn delay: playerState="+playerState+" alive="+player.alive);
  Input.fire=false;
  console.log("  [online] PASS: full client V1-V4 path ran with no error");
})();
`;

vm.createContext(sandbox);
try {
  vm.runInContext(code + DRIVER, sandbox, { filename:'page.js' });
  console.log('\nPASS: page loads AND the online client path runs headlessly.');
} catch (e) {
  console.log('  ✗ THREW:', e.message);
  console.log(e.stack.split('\n').slice(0,6).join('\n'));
  process.exit(1);
}
