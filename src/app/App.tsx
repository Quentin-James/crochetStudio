import { lazy, Suspense } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage'
import { PatternStudioPage } from '../features/pattern-studio/PatternStudioPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AppShell } from './AppShell'
import { isTauri } from './runtime'
import { SettingsProvider } from './SettingsProvider'
import { UpdateBanner } from './UpdateBanner'

/**
 * Clean URLs on the web; hash URLs in the desktop window.
 *
 * Tauri serves the built files through its own protocol and does not rewrite an
 * unknown path to `index.html`, so reloading on `/pattern` would 404. Routing by
 * hash removes the question entirely, and the desktop window has no address bar
 * for anyone to notice.
 */
const Router = isTauri() ? HashRouter : BrowserRouter

/**
 * The 3D studio is loaded on demand: Three.js is by far the heaviest dependency,
 * and someone browsing their projects should not download a renderer to do it.
 * It also keeps the first load light over Wi-Fi on an iPad.
 */
const Studio3DPage = lazy(() =>
  import('../features/studio3d/Studio3DPage').then((module) => ({
    default: module.Studio3DPage,
  })),
)

export function App() {
  return (
    <SettingsProvider>
      <Router>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/pattern" element={<PatternStudioPage />} />
            <Route
              path="/3d"
              element={
                <Suspense fallback={<p className="cs-boot">Chargement de l’atelier 3D…</p>}>
                  <Studio3DPage />
                </Suspense>
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <UpdateBanner />
      </Router>
    </SettingsProvider>
  )
}
