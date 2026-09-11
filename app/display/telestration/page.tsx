import { TelestrationApp } from '@/components/TelestrationApp';
import { TelestrationScoreRibbon } from '@/components/TelestrationScoreRibbon';

export default function TelestrationDisplayPage() {
  return <>
    <TelestrationApp mode="display" />
    <TelestrationScoreRibbon />
  </>;
}
