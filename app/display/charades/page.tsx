import { CharadesApp } from '@/components/CharadesApp';
import { CharadesThemeDisplay } from '@/components/CharadesThemePicker';

export default function CharadesDisplayPage() {
  return <>
    <CharadesApp mode="display" />
    <CharadesThemeDisplay />
  </>;
}
