import { useState } from 'react';
import ship from '../../../../assets/png/default/ships/ship_2.png';
import title from '../../../../assets/png/default/ui/menu/title_pirate_battle.png';
import title2x from '../../../../assets/png/retina/ui/menu/title_pirate_battle.png';
import { requestMatch, ROUTES, useAppNavigate } from '../../app/navigation';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import { RoundButton } from '../../components/RoundButton';
import { SoundToggle } from '../../components/SoundToggle';
import { ControlsDialog, ControlsSummary } from '../../help/ControlsDialog';
import { CaptainNameDialog } from '../../profile/CaptainNameDialog';
import { createCaptain } from '../../state/profile';
import { profileStore, usePersistedValue } from '../../state/settings';
import screen from '../screen.module.css';
import styles from './MenuScreen.module.css';

type MenuDialog = 'captain' | 'controls' | null;

/** Main menu (assets/sample_menu.png), plus the controls help and the sound toggle. */
export function MenuScreen() {
  const navigate = useAppNavigate();
  const profile = usePersistedValue(profileStore);
  const [dialog, setDialog] = useState<MenuDialog>(null);

  const startMatch = (): void => {
    requestMatch();
    navigate(ROUTES.play);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <RoundButton
          label="Controls"
          icon={{ drawn: 'help' }}
          aria-haspopup="dialog"
          onClick={() => {
            setDialog('controls');
          }}
        />
        <SoundToggle />
      </div>

      <Panel aria-labelledby="menu-title" className={styles.panel}>
        <h1 id="menu-title" className={styles.title}>
          <img
            className={styles.titleArt}
            src={title}
            srcSet={`${title} 1x, ${title2x} 2x`}
            alt="Pirate Battle"
            width={384}
            height={128}
          />
        </h1>
        <p className={styles.tagline}>Set sail. Take command.</p>
        <div className={screen.actions}>
          <Button
            onClick={() => {
              if (profile === null) setDialog('captain');
              else startMatch();
            }}
          >
            Play
          </Button>
          <Button
            onClick={() => {
              navigate(ROUTES.options);
            }}
          >
            Options
          </Button>
        </div>
        <img className={styles.ship} src={ship} alt="" width={66} height={113} />
        <p className={screen.text}>Navigate the islands. Survive the battle.</p>
        <ControlsSummary />
        <div className={screen.row}>
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              navigate(ROUTES.ranking);
            }}
          >
            Ranking
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              navigate(ROUTES.history);
            }}
          >
            Match history
          </Button>
        </div>
      </Panel>

      {dialog === 'captain' ? (
        <CaptainNameDialog
          mode="create"
          onCancel={() => {
            setDialog(null);
          }}
          onConfirm={(name) => {
            createCaptain(name);
            setDialog(null);
            startMatch();
          }}
        />
      ) : null}
      {dialog === 'controls' ? (
        <ControlsDialog
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}
    </>
  );
}
