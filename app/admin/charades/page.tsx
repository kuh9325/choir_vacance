import { CharadesApp } from '@/components/CharadesApp';
import { CharadesThemePicker } from '@/components/CharadesThemePicker';
import { GameAdminReturnBridge } from '@/components/GameAdminReturnBridge';

export default function CharadesAdminPage() {
  return <>
    <CharadesApp mode="admin" />
    <CharadesThemePicker />
    <GameAdminReturnBridge mode="charades" />
  </>;
}
