import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App.jsx";
import ErrorHandler from "./components/ErrorHandler/ErrorHandler.jsx";
import MessageBox from "./components/MessageBox/MessageBox.jsx";
import Loader from "./components/Loader/Loader.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import env from "./config/env.js";
import logger from "./utils/logger.js";
import "./styles/global.css";

logger.info(`Starting WBFMH frontend (${env.appEnv}) - API ${env.apiBaseUrl}`);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <MessageBox />
      <Loader />
      <ErrorHandler>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ErrorHandler>
    </ThemeProvider>
  </StrictMode>,
);
