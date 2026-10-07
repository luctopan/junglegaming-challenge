import logo from '../../../assets/logo_jungle_gaming.svg';
import scene from '../../../assets/ui_scene_background.png';
import styles from './App.module.css';

/**
 * Dimmed scene behind the menus (the mockups' menus sit on the arena). The
 * illustration has ships baked in, so it is only ever a softened backdrop,
 * never the arena (docs/ASSETS.md).
 */
export function Backdrop() {
  return (
    <>
      <div className={styles.backdrop} style={{ backgroundImage: `url("${scene}")` }} />
      <BrandLogo />
    </>
  );
}

export function BrandLogo({ className }: { readonly className?: string }) {
  return (
    <img
      className={className === undefined ? styles.logo : `${styles.logo} ${className}`}
      src={logo}
      alt="Jungle Gaming"
      draggable={false}
    />
  );
}
