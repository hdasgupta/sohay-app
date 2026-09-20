import "./Loader.css";
export default function Loader({ message = "Please wait..." }) {
  return (
    <div className="loader-overlay">
      <div className="loader-hourglass">⌛</div>
      <b>{message}</b>
    </div>
  );
}
