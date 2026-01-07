import styleAsset from './style.css?url';
import fontLight from './assets/fonts/ApercuMonoProLight.ttf?url';
import fontRegular from './assets/fonts/ApercuMonoProRegular.ttf?url';
import fontMedium from './assets/fonts/ApercuMonoProMedium.ttf?url';
import fontBold from './assets/fonts/ApercuMonoProBold.ttf?url';
import fontPlanet from './assets/fonts/PlanetKosmos.TTF?url';

if (typeof document !== 'undefined') {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

  const preloads: Array<{ href: string; as: 'style' | 'font' | 'image'; crossOrigin?: string; type?: string }> = [
    { href: styleAsset, as: 'style' },
    { href: fontLight, as: 'font', crossOrigin: 'anonymous', type: 'font/ttf' },
    { href: fontRegular, as: 'font', crossOrigin: 'anonymous', type: 'font/ttf' },
    { href: fontMedium, as: 'font', crossOrigin: 'anonymous', type: 'font/ttf' },
    { href: fontBold, as: 'font', crossOrigin: 'anonymous', type: 'font/ttf' },
    { href: fontPlanet, as: 'font', crossOrigin: 'anonymous', type: 'font/ttf' },
    { href: `${base}icons/wireframe_globe.png`, as: 'image' }
  ];

  preloads.forEach(({ href, as, crossOrigin, type }) => {
    if (!href) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = as;
    link.href = href;
    if (crossOrigin) link.crossOrigin = crossOrigin;
    if (type) link.type = type;
    document.head.appendChild(link);
  });
}
