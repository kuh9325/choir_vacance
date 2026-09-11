import { AdminGameLauncher } from '@/components/AdminGameLauncher';
import { ScoreApp } from '@/components/ScoreApp';

export default function AdminPage() {
  return <>
    <ScoreApp mode="admin" />
    <AdminGameLauncher />
  </>;
}
