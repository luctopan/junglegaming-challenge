import styles from './App.module.css';

interface StartupErrorProps {
  readonly message: string;
}

/** Shown when the app cannot boot (e.g. the mock backend failed to start). */
export function StartupError({ message }: StartupErrorProps) {
  return (
    <main className={styles.screen} role="alert">
      <h1 className={styles.title}>Pirate Battle</h1>
      <p>The game could not start: {message}</p>
      <p>Reload the page to try again.</p>
    </main>
  );
}
