import { CharadesApp } from '@/components/CharadesApp';
import { CharadesThemePicker } from '@/components/CharadesThemePicker';

export default function CharadesDisplayPage() {
  return <>
    <CharadesApp mode="display" />
    <CharadesThemePicker />
  </>;
}
