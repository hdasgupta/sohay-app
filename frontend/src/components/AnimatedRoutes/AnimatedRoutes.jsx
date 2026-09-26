import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Routes, useLocation } from "react-router";
import "./AnimatedRoutes.css";

export const EXIT_MS = 520;

/** Phase of the route layer a component is rendered in: 'enter' | 'idle' | 'exit' */
export const RouteLayerContext = createContext("idle");
export const useRouteLayerPhase = () => useContext(RouteLayerContext);

/**
 * <Navigate> that only fires in the live layer. The view that is sliding out keeps rendering its
 * old location, so a plain <Navigate> there would redirect again (and loop / undo the user's click).
 */
export function Redirect(props) {
  const phase = useRouteLayerPhase();
  if (phase === "exit") return null;
  return <Navigate {...props} />;
}

/**
 * Renders <Routes> with a slide-in-from-left transition on every view change.
 * The previous view is kept mounted while it slides/fades out, so it never vanishes abruptly.
 */
export default function AnimatedRoutes({ children, className = "" }) {
  const location = useLocation();
  const [layers, setLayers] = useState([
    { key: location.pathname, location, phase: "enter" },
  ]);

  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top.key === location.pathname) {
        return prev.map((l) => (l.key === top.key ? { ...l, location } : l));
      }
      const exiting = prev
        .filter((l) => l.key !== location.pathname)
        .slice(-1)
        .map((l) => ({ ...l, phase: "exit" }));
      return [...exiting, { key: location.pathname, location, phase: "enter" }];
    });
  }, [location]);

  // safety net: drop exiting layers even if animationend never fires (reduced motion, background tab, tests)
  const hasExit = layers.some((l) => l.phase === "exit");
  useEffect(() => {
    if (!hasExit) return undefined;
    const t = setTimeout(
      () => setLayers((prev) => prev.filter((l) => l.phase !== "exit")),
      EXIT_MS + 150,
    );
    return () => clearTimeout(t);
  }, [hasExit, layers]);

  const onAnimationEnd = (key, phase) => (e) => {
    if (e.target !== e.currentTarget) return;
    if (phase === "exit")
      setLayers((prev) =>
        prev.filter((l) => l.key !== key || l.phase !== "exit"),
      );
    else
      setLayers((prev) =>
        prev.map((l) => (l.key === key ? { ...l, phase: "idle" } : l)),
      );
  };

  return (
    <div className={`route-stage ${className}`}>
      {layers.map((l) => (
        <div
          key={l.key}
          className={`route-layer route-${l.phase}`}
          onAnimationEnd={onAnimationEnd(l.key, l.phase)}
          aria-hidden={l.phase === "exit" ? true : undefined}
          data-testid={`route-layer-${l.phase}`}
        >
          <RouteLayerContext.Provider value={l.phase}>
            <Routes location={l.location}>{children}</Routes>
          </RouteLayerContext.Provider>
        </div>
      ))}
    </div>
  );
}
