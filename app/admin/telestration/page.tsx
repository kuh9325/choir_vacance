import { GameAdminReturnBridge } from '@/components/GameAdminReturnBridge';
import { TelestrationDynamicApp } from '@/components/TelestrationDynamicApp';
import { TelestrationScoreDock } from '@/components/TelestrationScoreDock';

export default function TelestrationAdminPage() {
  return <>
    <TelestrationDynamicApp mode="admin" />
    <TelestrationScoreDock />
    <GameAdminReturnBridge mode="telestration" />
  </>;
}
