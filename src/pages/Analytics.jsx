import { Navigate } from 'react-router-dom';

/** Stats moved into Account; keep old path working. */
export default function Analytics() {
  return <Navigate to="/account" replace />;
}
