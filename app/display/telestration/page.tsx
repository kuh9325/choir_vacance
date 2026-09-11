import { TelestrationDynamicApp } from '@/components/TelestrationDynamicApp';
import { TelestrationScoreRibbonDynamic } from '@/components/TelestrationScoreRibbonDynamic';

export default function TelestrationDisplayPage() {
  return <>
    <TelestrationDynamicApp mode="display" />
    <TelestrationScoreRibbonDynamic />
  </>;
}
