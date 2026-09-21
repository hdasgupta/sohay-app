import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './PageTransition.css';

/**
 * Keeps the previous view mounted (fading / sliding out) while the new view
 * slides in from the left, so views never disappear abruptly.
 */
const PageTransition = ({ children }) => {
  const location = useLocation();
  const [current, setCurrent] = useState({ key: location.pathname, node: children });
  const [previous, setPrevious] = useState(null);
  const lastPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== lastPath.current) {
      setPrevious({ key: lastPath.current, node: current.node });
      lastPath.current = location.pathname;
      const timer = setTimeout(() => setPrevious(null), 420);
      console.log('[PageTransition] navigating to', location.pathname);
      setCurrent({ key: location.pathname, node: children });
      return () => clearTimeout(timer);
    }
    setCurrent({ key: location.pathname, node: children });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, children]);

  return (
    <div className="view-stage">
      {previous ? (
        <div className="view view-leaving" key={`prev-${previous.key}`} aria-hidden="true">
          {previous.node}
        </div>
      ) : null}
      <div className="view view-entering" key={`cur-${current.key}`}>
        {current.node}
      </div>
    </div>
  );
};

export default PageTransition;
