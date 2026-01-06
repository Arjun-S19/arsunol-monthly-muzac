export default function Footer() {
  const rawBase = import.meta.env.BASE_URL ?? '/';
  const normalized = rawBase === './' ? '' : rawBase.replace(/\/$/, '');
  const iconSrc = `${normalized}/icons/wireframe_globe.png`;

  return (
    <footer className="site-footer" aria-label="site footer">
      <span className="footer-mark" aria-hidden="true">
        <img className="globe-icon" src={iconSrc} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="footer-text">arsunol</span>
    </footer>
  );
}
