/* theme-switch.js — runtime theme/mode switcher + decoration layer.
   Two axes on <html>: data-theme (glass|heritage), data-mode (light|dark).
   Persists to localStorage; first visit defaults to glass + prefers-color-scheme. */
(function(){
  "use strict";
  var root = document.documentElement;

  // ---- restore / default ----
  var savedTheme = localStorage.getItem("kx-theme");
  var savedMode  = localStorage.getItem("kx-mode");
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var qs = new URLSearchParams(location.search);
  var theme = qs.get("kxtheme") || savedTheme || "glass";
  var mode  = qs.get("kxmode")  || savedMode  || (prefersDark ? "dark" : "light");
  apply();

  function apply(){
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-mode", mode);
    // keep Quarto's own dark class in sync so its components follow
    document.body && document.body.classList.toggle("quarto-dark", mode === "dark");
    localStorage.setItem("kx-theme", theme);
    localStorage.setItem("kx-mode", mode);
    syncUI();
  }

  // ---- SVG symbol defs (vine + butterfly), injected once ----
  function injectDefs(){
    if(document.getElementById("kx-defs")) return;
    var s = document.createElementNS("http://www.w3.org/2000/svg","svg");
    s.id = "kx-defs"; s.setAttribute("aria-hidden","true");
    s.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    s.innerHTML =
      '<symbol id="vine" viewBox="0 0 60 300">'+
      '<g stroke="var(--vine-line)" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+
      '<path d="M30 298 C12 270 48 246 30 218 C12 190 48 166 30 138 C12 110 48 86 30 58 C20 42 24 18 34 4"/>'+
      '<path d="M30 298 C46 272 14 248 30 220 C46 192 14 168 30 140 C46 112 14 88 30 60 C38 46 34 22 28 6" stroke-width="1" opacity=".7"/>'+
      '<g fill="var(--leaf-fill)" stroke-width="1">'+
      '<path d="M27 262 C16 258 8 248 10 238 C20 240 27 250 27 262 Z"/>'+
      '<path d="M34 230 C45 226 53 216 51 206 C41 208 34 218 34 230 Z"/>'+
      '<path d="M27 182 C16 178 8 168 10 158 C20 160 27 170 27 182 Z"/>'+
      '<path d="M34 150 C45 146 53 136 51 126 C41 128 34 138 34 150 Z"/>'+
      '<path d="M27 102 C16 98 8 88 10 78 C20 80 27 90 27 102 Z"/>'+
      '<path d="M34 70 C45 66 53 56 51 46 C41 48 34 58 34 70 Z"/></g>'+
      '<path d="M30 218 C40 214 46 206 42 200 C39 196 33 198 35 203 C36 206 40 205 40 202" stroke-width=".9"/>'+
      '<path d="M30 138 C20 134 14 126 18 120 C21 116 27 118 25 123 C24 126 20 125 20 122" stroke-width=".9"/>'+
      '<path d="M34 4 C40 10 48 12 52 8" stroke-width=".9"/></g></symbol>'+
      '<symbol id="butterfly" viewBox="0 0 100 90">'+
      '<g fill="none" stroke="var(--bfly-line)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">'+
      '<path d="M48 45 C36 26 22 12 12 13 C4 14 4 28 14 38 C20 44 32 48 48 48 Z"/>'+
      '<path d="M52 45 C64 26 78 12 88 13 C96 14 96 28 86 38 C80 44 68 48 52 48 Z"/>'+
      '<path d="M48 50 C36 54 26 62 24 70 C22 77 30 80 37 74 C43 69 47 60 48 52"/>'+
      '<path d="M52 50 C64 54 74 62 76 70 C78 77 70 80 63 74 C57 69 53 60 52 52"/>'+
      '<path d="M46 44 C38 34 28 24 18 19" stroke-width=".7"/>'+
      '<path d="M46 46 C36 40 26 36 16 34" stroke-width=".7"/>'+
      '<path d="M54 44 C62 34 72 24 82 19" stroke-width=".7"/>'+
      '<path d="M54 46 C64 40 74 36 84 34" stroke-width=".7"/>'+
      '<circle cx="12" cy="24" r=".9" fill="var(--bfly-line)" stroke="none"/>'+
      '<circle cx="88" cy="24" r=".9" fill="var(--bfly-line)" stroke="none"/>'+
      '<path d="M50 34 L50 62"/>'+
      '<path d="M49 33 C46 27 42 23 38 21 C36 20 35 22 37 23 M51 33 C54 27 58 23 62 21 C64 20 65 22 63 23" stroke-width=".8"/>'+
      '</g></symbol>'+'<symbol id="flourish" viewBox="0 0 120 120">'+'<g fill="none" stroke="var(--gold)" stroke-width="1.4" stroke-linecap="round">'+'<path d="M6 6 C6 40 14 70 48 78 C70 83 84 74 86 60 C88 49 80 41 70 44 C62 46 61 55 67 58"/>'+'<path d="M6 6 C40 6 70 14 78 48 C83 70 74 84 60 86 C49 88 41 80 44 70 C46 62 55 61 58 67"/>'+'<path d="M6 6 C22 10 30 18 33 33 C36 48 28 56 18 53" stroke-width=".9" opacity=".8"/>'+'<circle cx="66" cy="58" r="2" fill="var(--gold)" stroke="none"/>'+'<circle cx="58" cy="66" r="2" fill="var(--gold)" stroke="none"/>'+'<path d="M40 40 C44 36 50 36 52 40 C50 44 44 44 40 40 Z" fill="var(--leaf-fill)" stroke-width=".8"/>'+'</g></symbol>'+'<symbol id="fleuron" viewBox="0 0 80 24">'+'<g fill="none" stroke="var(--gold)" stroke-width="1.2" stroke-linecap="round">'+'<path d="M2 12 H30"/><path d="M50 12 H78"/>'+'<path d="M40 4 C44 8 44 16 40 20 C36 16 36 8 40 4 Z" fill="var(--leaf-fill)"/>'+'<path d="M33 12 C36 9 38 9 40 12 M47 12 C44 9 42 9 40 12" stroke-width=".9"/>'+'<circle cx="31" cy="12" r="1.4" fill="var(--gold)" stroke="none"/>'+'<circle cx="49" cy="12" r="1.4" fill="var(--gold)" stroke="none"/>'+'</g></symbol>';
    document.body.appendChild(s);
  }

  // ---- decoration layer: sparse vines + butterflies ----
  function injectDeco(){
    if(document.getElementById("kx-deco")) return;
    var d = document.createElement("div");
    d.id = "kx-deco"; d.className = "deco-layer"; d.setAttribute("aria-hidden","true");
    function use(id){ return '<svg class="'+id+'" aria-hidden="true"><use href="#'+(id==="vine"?"vine":"butterfly")+'"/></svg>'; }
    function bf(css, w, tint){ return '<svg class="bfly" style="'+css+';width:'+w+'px;height:'+Math.round(w*0.88)+'px'+(tint?(';--bfly-line:'+tint):'')+'"><use href="#butterfly"/></svg>'; }
    function vn(css, h, op){ return '<svg class="vine" style="'+css+';height:'+h+'px'+(op?(';opacity:'+op):'')+'"><use href="#vine"/></svg>'; }
    function fl(css){ return '<svg class="flourish" style="'+css+'" aria-hidden="true"><use href="#flourish"/></svg>'; }
    var G = "var(--gold)", S = "rgba(90,108,150,.42)", F = "rgba(161,106,31,.28)";
    d.innerHTML =
      // gilt corner flourishes (heritage item, all four corners)
      fl('top:6px;left:6px;width:96px;height:96px')+
      fl('top:6px;right:6px;width:96px;height:96px;transform:scaleX(-1)')+
      fl('bottom:6px;left:6px;width:96px;height:96px;transform:scaleY(-1)')+
      fl('bottom:6px;right:6px;width:96px;height:96px;transform:scale(-1,-1)')+
      // rope vines climbing both side gutters, top and bottom
      vn('top:40px;left:-6px', 320)+
      vn('top:300px;left:8px', 240, .6)+
      vn('bottom:30px;left:-6px', 300, .7)+
      vn('top:40px;right:-6px;transform:scaleX(-1)', 320)+
      vn('top:300px;right:8px;transform:scaleX(-1)', 240, .6)+
      vn('bottom:30px;right:-6px;transform:scaleX(-1)', 300, .7)+
      // a vine hanging from top-center and one rising bottom-center
      vn('top:-20px;left:46%;transform:rotate(96deg)', 200, .45)+
      vn('bottom:-20px;left:52%;transform:rotate(-96deg)', 200, .45)+
      // sparse butterflies — varied sizes & tints, in margins/corners
      bf('top:108px;right:7%', 36, G)+
      bf('top:34%;left:4%', 26, S)+
      bf('top:54%;right:5%', 22, F)+
      bf('bottom:20%;left:6%', 30, G)+
      bf('bottom:8%;right:9%', 24, S)+
      bf('top:72%;left:9%', 20, F)+
      bf('top:18%;left:13%', 18, F);
    document.body.insertBefore(d, document.body.firstChild);
  }

  // ---- switcher UI ----
  function buildUI(){
    if(document.getElementById("theme-switch")) return;
    var box = document.createElement("div");
    box.id = "theme-switch"; box.setAttribute("role","group"); box.setAttribute("aria-label","Theme");
    box.innerHTML =
      '<button data-fam="glass" title="Liquid Glass">Glass</button>'+
      '<button data-fam="heritage" title="Heritage / Ornamental">Heritage</button>'+
      '<span class="ts-sep"></span>'+
      '<button class="ts-mode" data-mode-toggle title="Light / Dark">☾</button>';
    document.body.appendChild(box);
    box.querySelectorAll("[data-fam]").forEach(function(b){
      b.addEventListener("click", function(){ theme = b.getAttribute("data-fam"); apply(); });
    });
    box.querySelector("[data-mode-toggle]").addEventListener("click", function(){
      mode = (mode === "dark") ? "light" : "dark"; apply();
    });
  }

  function syncUI(){
    var box = document.getElementById("theme-switch"); if(!box) return;
    box.querySelectorAll("[data-fam]").forEach(function(b){
      b.classList.toggle("active", b.getAttribute("data-fam") === theme);
    });
    var m = box.querySelector("[data-mode-toggle]");
    if(m) m.textContent = (mode === "dark") ? "☀" : "☾";
  }

  function boot(){ injectDefs(); injectDeco(); buildUI(); apply(); }
  if(document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
  document.addEventListener("quarto-after-body", boot);
})();
