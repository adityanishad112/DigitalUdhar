import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { PageBody } from '@/components/layout/PageBody';
import { QrScanner } from '@/components/qr/QrScanner';
import { useT } from '@/i18n';

export function Scan() {
  const { t } = useT();
  const navigate = useNavigate();

  return (
    <>
      <TopBar title={t('scan.title')} back />
      <PageBody>
        <p className="px-1 text-sm text-ink-500">{t('scan.hint')}</p>
        <QrScanner onToken={(token) => navigate(`/app/shop/${encodeURIComponent(token)}`)} />
      </PageBody>
    </>
  );
}
