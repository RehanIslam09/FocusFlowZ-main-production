import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeProvider';

import './index.css';
import App from './App.jsx';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkLoadedApp() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPubKey} allowedRedirectOrigins={['*']}>
      <BrowserRouter>
        <ThemeProvider>
          <ClerkLoadedApp />
        </ThemeProvider>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
