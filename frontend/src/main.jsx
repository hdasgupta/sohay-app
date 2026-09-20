import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MessageProvider } from './context/MessageContext';
import { LoaderProvider } from './context/LoaderContext';
import './styles/global.css';

console.log('[app] starting frontend, api base url =', import.meta.env.VITE_API_BASE_URL);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* The whole application lives inside the error handler tag. */}
    <ErrorBoundary>
      <ThemeProvider>
        <MessageProvider>
          <LoaderProvider>
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </LoaderProvider>
        </MessageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
