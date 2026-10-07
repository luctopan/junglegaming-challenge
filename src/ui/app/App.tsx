import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { OptionsScreen } from '../screens/options/OptionsScreen';
import { MenuScreen } from '../screens/menu/MenuScreen';
import { MatchLayout } from './MatchLayout';
import { MenuShell } from './MenuShell';

/**
 * Screens (docs/DECISIONS.md "Routing"): menu routes share the dimmed
 * backdrop; `/play` and `/result` share one layout so a finished match can
 * show its result at `/result` without unmounting the arena.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MenuShell />}>
          <Route index element={<MenuScreen />} />
          <Route path="options" element={<OptionsScreen />} />
        </Route>
        <Route element={<MatchLayout />}>
          <Route path="play" element={null} />
          <Route path="result" element={null} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
