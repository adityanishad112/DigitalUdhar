import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFound() {
  return (
    <div className="app-frame min-h-dvh items-center justify-center px-8 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="font-display text-6xl font-extrabold text-brand-500">404</div>
        <p className="mt-2 text-ink-500">This page could not be found.</p>
        <Link to="/" className="mt-6">
          <Button variant="outline">Go home</Button>
        </Link>
      </div>
    </div>
  );
}
