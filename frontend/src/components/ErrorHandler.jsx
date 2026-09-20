import React from "react";
import "./ErrorHandler.css";
export default class ErrorHandler extends React.Component {
  constructor(p) {
    super(p);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[UI ERROR]", error, info);
    try {
      alert(error.message);
    } catch {}
  }
  render() {
    if (this.state.error)
      return (
        <div className="runtime-error">
          <h2>Unexpected runtime error</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => location.reload()}>Reload application</button>
        </div>
      );
    return this.props.children;
  }
}
