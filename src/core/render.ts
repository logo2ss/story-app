import { type Asset, type Page, type Project, type Style } from "./model";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export type AssetResolver = (asset: Asset) => string;
export function renderPage(
  project: Project,
  page: Page,
  resolve: AssetResolver,
  style: Style,
  index: number,
) {
  const photos = page.assetIds
    .map((id) => {
      const a = project.assets.find((a) => a.id === id);
      return a
        ? `<figure><div class="photo-frame"><img loading="lazy" src="${escapeHtml(resolve(a))}" alt="${escapeHtml(a.caption || a.name)}" style="object-fit:${a.crop};object-position:${a.focusX}% ${a.focusY}%;transform:rotate(${a.rotation}deg)"></div>${style.captions && a.caption ? `<figcaption>${escapeHtml(a.caption)}</figcaption>` : ""}</figure>`
        : `<figure class="missing">Picture unavailable. Reimport the asset.</figure>`;
    })
    .join("");
  const text = `${page.text ? `<div class="story-text">${escapeHtml(page.text)}</div>` : ""}`;
  return `<article class="story-page layout-${page.layout} mode-${project.mode}" dir="${project.language === "ar" ? "rtl" : "ltr"}" style="${styleVars(style)}"><div class="page-content"><div class="photos">${photos}</div>${text}</div>${page.bubbles.map((b) => `<div class="bubble bubble-${b.type}" style="left:${b.x}%;top:${b.y}%;background:${b.color};font-size:${b.size}px">${escapeHtml(b.text)}</div>`).join("")}${style.numbers ? `<footer class="folio"><span>${escapeHtml(project.title)}</span><span>${index + 1}</span></footer>` : ""}</article>`;
}
export function styleVars(s: Style) {
  return `--paper:${s.background};--ink:${s.color};--bodyfont:'${s.font}';--fontsize:${s.fontSize}px;--leading:${s.lineHeight};--margin:${s.margin}px;--radius:${s.radius}px;--border:${s.border}px;--gap:${s.gap}px;--imageheight:${s.imageHeight}px;text-align:${s.align}`;
}
export const presentationCss = `
*{box-sizing:border-box} .story-page{position:relative;background:var(--paper);color:var(--ink);padding:var(--margin);font-family:var(--bodyfont),serif;min-height:650px;overflow-wrap:anywhere} .page-content{display:flex;flex-direction:column;gap:var(--gap)} .story-text{white-space:pre-wrap;font-size:var(--fontsize);line-height:var(--leading);position:relative;z-index:1} .photos{display:grid;grid-template-columns:1fr;gap:var(--gap)} figure{margin:0;min-width:0;break-inside:avoid} .photo-frame{height:var(--imageheight);overflow:hidden;border:var(--border) solid currentColor;border-radius:var(--radius)} .photo-frame img{display:block;width:100%;height:100%} figcaption{font:italic 12px/1.5 Georgia,serif;padding:8px 0;opacity:.75} .layout-below .photos{order:2} .layout-beside .page-content{display:grid;grid-template-columns:1fr 1fr;align-items:start} .layout-two .photos,.layout-grid .photos,.layout-three .photos{grid-template-columns:repeat(2,minmax(0,1fr))} .layout-three figure:first-child{grid-column:1/-1} .layout-full .photo-frame{height:500px} .layout-overlay .page-content{position:relative} .layout-overlay .photos{position:absolute;inset:0;opacity:.22} .layout-overlay .story-text{padding:24px;background:color-mix(in srgb,var(--paper) 65%,transparent);min-height:var(--imageheight)} .layout-text .photos{grid-template-columns:repeat(2,minmax(0,1fr))} .folio{display:flex;justify-content:space-between;border-top:1px solid currentColor;opacity:.5;font:10px Arial,sans-serif;letter-spacing:2px;margin-top:35px;padding-top:12px;text-transform:uppercase} .bubble{position:absolute;max-width:65%;padding:12px 18px;border:2px solid #222;color:#222;z-index:2;white-space:pre-wrap;font-family:Arial,sans-serif;overflow-wrap:anywhere} .bubble-speech{border-radius:45%} .bubble-thought{border-radius:50%;border-style:dashed} .bubble-caption{border-radius:3px} .missing{padding:20px;border:1px dashed #a66} .book-cover{display:flex;flex-direction:column;justify-content:center;text-align:center;min-height:700px;background:var(--paper);color:var(--ink);padding:60px;font-family:var(--bodyfont),serif} .book-cover h1{font-size:48px;font-weight:normal;line-height:1.2} .book-cover img{max-height:360px;max-width:100%;object-fit:contain} .book-cover .author{letter-spacing:3px;text-transform:uppercase;font-size:12px;margin-top:40px} @media print{.story-page,.book-cover{break-before:page;min-height:0;box-shadow:none}.story-page:first-child,.book-cover:first-child{break-before:auto}.story-text{orphans:3;widows:3}.photos{break-inside:auto}.photo-frame{max-height:90mm}.folio{break-inside:avoid}.bubble{position:relative;display:inline-block;left:auto!important;top:auto!important;margin:8px}.layout-beside .page-content{display:block}.layout-overlay .photos{position:relative;opacity:1}.layout-overlay .story-text{min-height:0}.no-print{display:none!important}}`;
export function exportHtml(
  project: Project,
  resolve: AssetResolver,
  print = false,
) {
  const { pages, style } = project.presentations[project.mode];
  const cover = project.assets.find((a) => a.id === project.coverId);
  const content =
    (style.cover
      ? `<section class="book-cover" style="${styleVars(style)}" dir="${project.language === "ar" ? "rtl" : "ltr"}">${cover ? `<img src="${escapeHtml(resolve(cover))}" alt="Cover">` : ""}<h1>${escapeHtml(project.title)}</h1><p>${escapeHtml(project.subtitle)}</p><p class="author">${escapeHtml(project.author)}</p></section>`
      : "") +
    pages.map((p, i) => renderPage(project, p, resolve, style, i)).join("");
  return `<!doctype html><html lang="${project.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';"><title>${escapeHtml(project.title)}</title><style>${presentationCss} body{margin:0;background:#17231e}main{max-width:850px;margin:auto}.story-page,.book-cover{margin:24px 0}nav{position:sticky;top:0;padding:12px;text-align:center;background:#17231e;color:#fff;z-index:10;font:14px Arial}button{background:#faf7ef;border:0;border-radius:6px;padding:10px 16px;cursor:pointer;margin:0 5px}.playing>*{display:none}.playing>.active{display:block;animation:appear ${style.transitionSpeed}s}.playing{min-height:90vh}@keyframes appear{from{opacity:0;transform:${style.transition === "slide" ? "translateX(30px)" : style.transition === "zoom" ? "scale(.96)" : "none"}}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}@media print{body{background:white}main{max-width:none}.story-page,.book-cover{margin:0}}</style></head><body>${!print ? '<nav class="no-print"><button id="prev">← Previous</button><span id="position"></span><button id="next">Next →</button><button id="play">Play / Pause</button><button id="full">Fullscreen</button></nav>' : ""}<main id="pages">${content}</main>${!print ? `<script>const root=document.getElementById('pages'),pages=[...root.children];let index=0,timer;root.classList.add('playing');function show(n){index=Math.max(0,Math.min(n,pages.length-1));pages.forEach((p,i)=>p.classList.toggle('active',i===index));document.getElementById('position').textContent=(index+1)+' / '+pages.length;}show(0);document.getElementById('prev').onclick=()=>show(index-1);document.getElementById('next').onclick=()=>show(index+1);document.getElementById('play').onclick=()=>{if(timer){clearInterval(timer);timer=null;}else timer=setInterval(()=>{if(index===pages.length-1){clearInterval(timer);timer=null;}else show(index+1)},${style.duration * 1000})};document.getElementById('full').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});</script>` : ""}</body></html>`;
}
