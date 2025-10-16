import { Link, useLocation } from 'react-router-dom';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  manage: 'Manage Loans',
  accepted: 'Accepted Loans',
  disbursed: 'Disbursed Loans',
  payments: 'Payment Tracker',
  merchants: 'Merchant Details',
  loans: 'My Loan Applications',
  products: 'Product Information',
  admin: 'Admin',
};

function titleFor(segment: string) {
  return LABELS[segment] || segment.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function Breadcrumbs() {
  const location = useLocation();
  const path = location.pathname.replace(/^\/+|\/+$/g, '');
  const parts = path ? path.split('/') : [];

  const crumbs = parts.length > 0 ? parts : ['dashboard'];

  let acc = '';
  return (
    <nav className="text-sm text-gray-500 dark:text-gray-400" aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 flex-wrap">
        <li>
          <Link to="/dashboard" className="hover:underline">Home</Link>
        </li>
        {crumbs.map((seg, idx) => {
          acc += `/${seg}`;
          const last = idx === crumbs.length - 1;
          return (
            <li key={idx} className="flex items-center gap-2">
              <span>/</span>
              {last ? (
                <span className="text-gray-700 dark:text-gray-200 font-medium">{titleFor(seg)}</span>
              ) : (
                <Link to={acc} className="hover:underline">{titleFor(seg)}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
