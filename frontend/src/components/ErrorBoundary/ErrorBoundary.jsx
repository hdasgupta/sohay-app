import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * Custom tag that wraps the whole <App/>. Any runtime error thrown while
 * rendering is caught here and shown in an alert style message box.
 * Global window errors / unhandled promise rejections are captured as well.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorHandler] render error caught:', error, info);
    this.setState({ info });
  }

  componentDidMount() {
    this.onError = (event) => {
      console.error('[ErrorHandler] window error:', event.message);
      this.setState({ error: new Error(event.message) });
    };
    this.onRejection = (event) => {
      const reason = event.reason?.message || String(event.reason);
      console.error('[ErrorHandler] unhandled rejection:', reason);
      this.setState({ error: new Error(reason) });
    };
    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onError);
    window.removeEventListener('unhandledrejection', this.onRejection);
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <>
        {this.props.children}
        <div className="eh-backdrop" role="alertdialog" aria-modal="true">
          <div className="eh-box">
            <h3 className="eh-title">Something went wrong</h3>
            <p className="eh-message">{error.message || 'An unexpected runtime error occurred.'}</p>
            {info?.componentStack ? (
              <details className="eh-details">
                <summary>Technical details</summary>
                <pre>{info.componentStack}</pre>
              </details>
            ) : null}
            <div className="row end">
              <button type="button" className="btn btn-ghost" onClick={this.reset}>
                Dismiss
              </button>
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                Reload application
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default ErrorBoundary;
