import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App'; import ErrorHandler from './components/ErrorHandler'; import {AppProvider} from './context/AppContext'; import './styles.css';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorHandler><AppProvider><App/></AppProvider></ErrorHandler></React.StrictMode>);
