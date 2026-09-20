import './Card.css';

/** Decorated div used by every listing page. */
const Card = ({ title, subtitle, badge, badgeTone = 'info', children, actions, accent = false }) => (
  <article className={`info-card ${accent ? 'accent' : ''}`}>
    <header className="info-card-head">
      <div className="info-card-heading">
        <h4 className="info-card-title">{title}</h4>
        {subtitle ? <span className="info-card-subtitle">{subtitle}</span> : null}
      </div>
      {badge ? <span className={`chip ${badgeTone}`}>{badge}</span> : null}
    </header>
    {children ? <div className="info-card-body">{children}</div> : null}
    {actions ? <footer className="info-card-actions">{actions}</footer> : null}
  </article>
);

export const CardRow = ({ label, value }) => (
  <div className="card-row">
    <span className="card-row-label">{label}</span>
    <span className="card-row-value">{value}</span>
  </div>
);

export default Card;
