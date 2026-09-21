import { Link } from 'react-router-dom';
import './NotFoundPage.css';
import OrgLogo from '../../components/OrgLogo/OrgLogo';

const NotFoundPage = () => (
  <div className="auth-wrap notfound-page">
    <div className="auth-card center">
      <OrgLogo size={72} className="nf-logo" />
      <h2>Page not found</h2>
      <p className="hint">The page you are looking for does not exist in this portal.</p>
      <Link className="btn btn-primary" to="/login">
        Go to login
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
