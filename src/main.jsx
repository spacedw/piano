import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import '@/styles/index.css'
import AppLayout from '@/layouts/AppLayout'
import PlayerPage from '@/pages/PlayerPage'
import LibraryPage from '@/pages/LibraryPage'
import ProgressPage from '@/pages/ProgressPage'
import { I18nProvider } from '@/i18n'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<PlayerPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="progress" element={<ProgressPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)
