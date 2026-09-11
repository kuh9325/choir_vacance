import { GameAdminReturnBridge } from '@/components/GameAdminReturnBridge';
import { TelestrationApp } from '@/components/TelestrationApp';
import { TelestrationScoreDock } from '@/components/TelestrationScoreDock';

export default function TelestrationAdminPage() {
  return <>
    <TelestrationApp mode="admin" />
    <TelestrationScoreDock />
    <GameAdminReturnBridge mode="telestration" />
  </>;
}
