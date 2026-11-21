// Glass folder shared by Projects (W03) and Reports (W11).
// Outlines from design/source/W03-Projects.dc.html (.gf-back / .gf-front), in the unscaled 340px box.
export const FOLDER_ART = ['ember-11', 'dusk-5', 'verdant-7', 'aurora-29', 'glacier-2', 'aurora-3', 'dusk-17'];
export const FOLDER_BACK_PATH = 'M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z';
export const FOLDER_FRONT_PATH = 'M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 176A22 22 0 0 1 318 198L22 198A22 22 0 0 1 0 176Z';

/** Stable art per seed (project code / id), so a folder keeps its picture. */
export function folderArt(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `/art/${FOLDER_ART[h % FOLDER_ART.length]}.png`;
}

export const FOLDER_STYLES = `
    .folder-box { position: relative; width: 265px; height: 254px; flex: none; }
    .folder { position: absolute; left: 0; top: 0; width: 340px; height: 326px; transform: scale(0.78); transform-origin: 0 0; isolation: isolate; --hinge: 0deg; }
    .folder:hover, .folder:focus-within { --hinge: -11deg; }
    .stage { position: absolute; left: 0; top: 54px; width: 340px; height: 272px; }
    .shadow { position: absolute; left: 18px; right: 18px; bottom: -6px; height: 60px; border-radius: 40px; background: rgb(16 18 24 / 0.3); filter: blur(22px); }
    .back { position: absolute; inset: 0; overflow: hidden; clip-path: path('${FOLDER_BACK_PATH}'); background: linear-gradient(180deg, rgb(243 243 244), rgb(227 227 230)); }
    .back img { position: absolute; left: -12px; top: -12px; width: 364px; height: 296px; max-width: none; object-fit: cover; }
    .front {
      position: absolute; left: 0; top: 74px; width: 340px; height: 198px; z-index: 10; clip-path: path('${FOLDER_FRONT_PATH}');
      backdrop-filter: blur(22px) saturate(1.5); transform-origin: 50% 100%; transform: perspective(760px) rotateX(var(--hinge));
      transition: transform 0.8s cubic-bezier(0.34, 1.36, 0.5, 1);
    }
    .tint { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(255 255 255 / 0.16) 0%, rgb(255 255 255 / 0.5) 42%, rgb(252 252 252 / 0.93) 100%); }
    .rim { position: absolute; inset: 0; width: 340px; height: 198px; fill: none; pointer-events: none; overflow: visible; }
    .hit { position: absolute; inset: 0; z-index: 1; }
    .hit:focus-visible { outline: none; }
    .hit:focus-visible ~ .label .title { text-decoration: underline; text-underline-offset: 4px; }
    .label { position: absolute; z-index: 2; left: 28px; bottom: 30px; display: flex; flex-direction: column; gap: 4px; max-width: 210px; pointer-events: none; }
    .title { font-size: 18px; font-weight: 500; line-height: 1.15; letter-spacing: -0.012em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.03em; color: rgb(20 20 22 / 0.62); white-space: nowrap; }
    .key { position: absolute; right: 22px; bottom: 22px; z-index: 12; }
    @media (prefers-reduced-motion: reduce) { .front { transition: none; } }
`;
