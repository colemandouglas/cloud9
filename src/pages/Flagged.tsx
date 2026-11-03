import { Link } from "react-router-dom";
import { RED_FLAG_COPY } from "../components/ui";

export default function Flagged() {
  return (
    <>
      <div className="alert" role="alert">
        <b>See your doctor first</b>
        {RED_FLAG_COPY} Your intake was saved and flagged for the clinician.
      </div>
      <Link className="btn ghost" to="/app">Back to your cases</Link>
    </>
  );
}
