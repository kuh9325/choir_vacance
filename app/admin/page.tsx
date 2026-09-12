import { AdminGameLauncher } from '@/components/AdminGameLauncher';
import { ScoreApp } from '@/components/ScoreApp';
import { TeamSetupDock } from '@/components/TeamSetupDock';

export default function AdminPage() {
  return <>
    <ScoreApp mode="admin" />
    <AdminGameLauncher />
    <TeamSetupDock />
  </>;
}
