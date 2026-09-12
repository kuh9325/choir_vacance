import { GameAdminReturnBridge } from '@/components/GameAdminReturnBridge';
import { TelestrationDynamicApp } from '@/components/TelestrationDynamicApp';
import { TelestrationScoreDockDynamic } from '@/components/TelestrationScoreDockDynamic';

export default function TelestrationAdminPage() {
  return <>
    <TelestrationDynamicApp mode="admin" />
    <TelestrationScoreDockDynamic />
    <GameAdminReturnBridge mode="telestration" />
  </>;
}
