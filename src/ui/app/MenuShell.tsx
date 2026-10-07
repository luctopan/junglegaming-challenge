import { Outlet } from 'react-router';
import { Backdrop } from './Backdrop';
import styles from './App.module.css';

/** Menu screens: the scene backdrop, the brand logo, and the screen's panel centred on top. */
export function MenuShell() {
  return (
    <div className={styles.shell}>
      <Backdrop />
      <main className={styles.screen}>
        <Outlet />
      </main>
    </div>
  );
}
