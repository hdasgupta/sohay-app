import { Link } from "react-router";
import "./NotFoundPage.css";

export default function NotFoundPage({ home = "/" }) {
  return (
    <div className="not-found">
      <span className="nf-code">404</span>
      <h1>Page not found</h1>
      <p className="muted">
        The page you are looking for does not exist or you do not have access to
        it.
      </p>
      <Link to={home} className="btn btn-primary">
        Go to home
      </Link>
    </div>
  );
}
