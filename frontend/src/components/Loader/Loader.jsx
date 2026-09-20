import './Loader.css';

/**
 * Animated hour glass loader. Rendered as a full screen overlay while any
 * backend call is in flight (see LoaderContext).
 */
const Loader = ({ message = 'Talking to the server, please wait...', inline = false }) => (
  <div className={inline ? 'loader-inline' : 'loader-overlay'} role="status" aria-live="polite">
    <div className="loader-box">
      <div className="hourglass">
        <span className="glass">
          <span className="sand-top" />
          <span className="sand-bottom" />
        </span>
      </div>
      <p className="loader-message">{message}</p>
    </div>
  </div>
);

export default Loader;
