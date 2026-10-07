import { ROUTES, useAppNavigate } from '../../app/navigation';
import { Panel } from '../../components/Panel';
import { OptionsPanel } from './OptionsPanel';

/** The Options route, opened from the main menu. */
export function OptionsScreen() {
  const navigate = useAppNavigate();
  return (
    <Panel aria-labelledby="options-title">
      <OptionsPanel
        context="menu"
        headingId="options-title"
        doneLabel="Main menu"
        onDone={() => {
          navigate(ROUTES.menu);
        }}
      />
    </Panel>
  );
}
