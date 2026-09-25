import { Component } from 'react';
import { notify } from '../../utils/eventBus.js';
import logger from '../../utils/logger.js';
import './ErrorHandler.css';

/**
 * Wraps the whole app. Catches render errors (error boundary) plus uncaught errors and unhandled
 * promise rejections and shows them in the message box.
 */
export default class ErrorHandler extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.onWindowError = this.onWindowError.bind(this);
    this.onRejection = this.onRejection.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onRejection);
  }

  componentDidCatch(error, info) {
    logger.error('Render error caught by ErrorHandler', error, info?.componentStack);
    notify.error(`Something went wrong: ${error?.message || error}`);
  }

  onWindowError(event) {
    logger.error('Uncaught runtime error', event.error || event.message);
    notify.error(`Unexpected error: ${event.error?.message || event.message || 'unknown error'}`);
  }

  onRejection(event) {
    const reason = event.reason;
    if (reason?.isApiError) { event.preventDefault?.(); return; } // already shown by the API client
    logger.error('Unhandled promise rejection', reason);
    notify.error(`Unexpected error: ${reason?.message || String(reason)}`);
  }

  render() {
    if (this.state.error) {
      return (
        <>
          {this.props.fallbackExtras}
          <div className="eh-fallback" role="alert">
            <div className="eh-card">
              <h2>Something went wrong</h2>
              <p className="muted">{String(this.state.error?.message || this.state.error)}</p>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
                <button type="button" className="btn btn-ghost" onClick={() => window.location.assign('/')}>Go to home</button>
              </div>
            </div>
          </div>
        </>
      );
    }
    return this.props.children;
  }
}
