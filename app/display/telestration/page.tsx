import { TelestrationDynamicApp } from '@/components/TelestrationDynamicApp';
import { TelestrationScoreRibbon } from '@/components/TelestrationScoreRibbon';

export default function TelestrationDisplayPage() {
  return <>
    <TelestrationDynamicApp mode="display" />
    <TelestrationScoreRibbon />
  </>;
}
