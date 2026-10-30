(function(){
var mobile=window.matchMedia('(max-width:760px)');
var coarse=window.matchMedia('(pointer:coarse)').matches;
var desk=document.getElementById('desk'),dock=document.getElementById('dock');
var wins=[].slice.call(document.querySelectorAll('.win'));
var z=10;

/* Açılış ekranı: oturum başına bir kez */
var boot=document.getElementById('boot');
function endBoot(){boot.classList.add('off');setTimeout(function(){boot.remove()},400)}
var seen=false;try{seen=sessionStorage.getItem('gz-boot')==='1';sessionStorage.setItem('gz-boot','1')}catch(e){}
if(seen||window.matchMedia('(prefers-reduced-motion: reduce)').matches)endBoot();
else{
  var lines=['Mmmm… yükleniyor…','Masaüstü hazırlanıyor…','Gece hattı çalıştırılıyor…','Hazır.'],i=0;
  var bar=document.getElementById('boot-bar'),line=document.getElementById('boot-line');
  var tm=setInterval(function(){i++;bar.style.width=(i/lines.length*100)+'%';line.textContent=lines[Math.min(i,lines.length-1)];if(i>=lines.length){clearInterval(tm);setTimeout(endBoot,250)}},380);
  boot.addEventListener('click',function(){clearInterval(tm);endBoot()});
}

if(coarse||mobile.matches)document.querySelector('.hello small').textContent='Bir simgeye dokun.';

/* Saat */
var clock=document.getElementById('clock');
function tick(){var d=new Date();clock.textContent=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
tick();setInterval(tick,15000);

/* Pencere yerleşimi: data-x/y masaüstü genişliğine göre ölçeklenir */
function place(w){
  if(mobile.matches)return;
  var W=desk.clientWidth,H=desk.clientHeight,base=document.querySelector('.icons').offsetWidth+40;
  var ww=Math.max(300,Math.min(+w.dataset.w||400,W-base-20));
  var x=Math.min(base+(+w.dataset.x||160)-160,W-ww-20),y=Math.min(+w.dataset.y||40,H-200);
  if(w.id==='w-devlog')x=W-ww-24;
  w.style.width=ww+'px';w.style.left=Math.max(base,x)+'px';w.style.top=Math.max(8,y)+'px';
  w.style.maxHeight=(H-Math.max(8,y)-80)+'px';
}
wins.forEach(place);

function iconOf(w){var ic=document.querySelector('.ic[data-open="'+w.id+'"] i');return ic?{bg:ic.style.background,t:ic.textContent}:{bg:'var(--lilac)',t:'·'}}
function titleOf(w){return w.querySelector('.tb span').textContent.split(' — ')[0]}

function focus(w){
  wins.forEach(function(o){o.classList.toggle('active',o===w)});
  w.style.zIndex=++z;renderDock();
}
function open(id,noHash){
  var w=document.getElementById(id);if(!w)return;
  w.hidden=false;w.classList.remove('minimized');
  focus(w);
  if(mobile.matches)w.scrollIntoView({behavior:'smooth',block:'start'});
  if(!noHash&&w.id!=='w-locked'&&history.replaceState)history.replaceState(null,'','#'+id.slice(2));
}
function close(w){w.hidden=true;w.classList.remove('max');renderDock()}
function minimize(w){w.hidden=true;w.classList.add('minimized');renderDock()}

function renderDock(){
  dock.innerHTML='';
  wins.forEach(function(w){
    if(w.hidden&&!w.classList.contains('minimized'))return;
    var ic=iconOf(w),b=document.createElement('button');
    b.innerHTML='<i style="background:'+ic.bg+'">'+ic.t+'</i>'+titleOf(w);
    if(w.classList.contains('active')&&!w.hidden)b.className='on';
    if(w.classList.contains('minimized'))b.className='min';
    b.addEventListener('click',function(){
      if(!w.hidden&&w.classList.contains('active'))minimize(w);else open(w.id,true);
    });
    dock.appendChild(b);
  });
}

/* Simgeler: masaüstünde çift tık, dokunmatik/mobilde tek dokunuş */
document.querySelectorAll('.ic').forEach(function(ic){
  ic.addEventListener('click',function(){
    document.querySelectorAll('.ic.sel').forEach(function(o){o.classList.remove('sel')});
    ic.classList.add('sel');
    if(coarse||mobile.matches)open(ic.dataset.open);
  });
  ic.addEventListener('dblclick',function(){open(ic.dataset.open)});
  ic.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();open(ic.dataset.open)}});
});
document.querySelectorAll('[data-open]:not(.ic)').forEach(function(b){
  b.addEventListener('click',function(){open(b.dataset.open)});
});

/* Pencere kontrolleri ve sürükleme */
wins.forEach(function(w){
  w.addEventListener('pointerdown',function(){focus(w)});
  w.querySelectorAll('[data-close]').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();close(w)})});
  var mn=w.querySelector('[data-min]');if(mn)mn.addEventListener('click',function(e){e.stopPropagation();minimize(w)});
  var mx=w.querySelector('[data-max]');if(mx)mx.addEventListener('click',function(e){e.stopPropagation();w.classList.toggle('max')});
  var tb=w.querySelector('.tb');
  tb.addEventListener('dblclick',function(e){if(!e.target.closest('button')&&!mobile.matches)w.classList.toggle('max')});
  tb.addEventListener('pointerdown',function(e){
    if(mobile.matches||e.target.closest('button')||w.classList.contains('max'))return;
    var sx=e.clientX-w.offsetLeft,sy=e.clientY-w.offsetTop;
    tb.setPointerCapture(e.pointerId);
    function mv(ev){
      var x=Math.max(-w.offsetWidth+80,Math.min(desk.clientWidth-80,ev.clientX-sx));
      var y=Math.max(0,Math.min(desk.clientHeight-40,ev.clientY-sy));
      w.style.left=x+'px';w.style.top=y+'px';
    }
    function up(){tb.removeEventListener('pointermove',mv);tb.removeEventListener('pointerup',up)}
    tb.addEventListener('pointermove',mv);tb.addEventListener('pointerup',up);
  });
});

/* Oyun filtresi */
document.querySelectorAll('.filters button').forEach(function(b){
  b.addEventListener('click',function(){
    document.querySelectorAll('.filters button').forEach(function(o){o.classList.toggle('on',o===b)});
    document.querySelectorAll('.list li').forEach(function(li){li.hidden=b.dataset.f!=='all'&&li.dataset.p!==b.dataset.f});
  });
});

/* Görsel büyütme */
var lb=document.getElementById('lb'),lbi=lb.querySelector('img');
document.querySelectorAll('[data-lb]').forEach(function(a){
  a.addEventListener('click',function(e){e.preventDefault();lbi.src=a.href;lbi.alt=a.querySelector('img').alt;lb.hidden=false});
});
lb.addEventListener('click',function(){lb.hidden=true});
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  if(!lb.hidden){lb.hidden=true;return}
  var a=document.querySelector('.win.active:not([hidden])');if(a)close(a);
});

/* Adres çubuğundaki #pencere ile aç (paylaşılabilir bağlantı) */
var h=location.hash.slice(1);
if(h&&document.getElementById('w-'+h))open('w-'+h,true);
else{var first=document.getElementById('w-hat0');focus(first)}

window.addEventListener('resize',function(){if(!mobile.matches)wins.forEach(function(w){if(!w.classList.contains('max'))place(w)})});
})();
