import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppProvider } from '@/state/app';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="fs:theme" disableTransitionOnChange>
      <TooltipProvider delayDuration={250}>
        <AppProvider>
          <App />
          <Toaster position="bottom-center" richColors />
        </AppProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
