import { CharadesApp } from '@/components/CharadesApp';
import { GameAdminReturnBridge } from '@/components/GameAdminReturnBridge';

export default function CharadesAdminPage() {
  return <>
    <CharadesApp mode="admin" />
    <GameAdminReturnBridge mode="charades" />
  </>;
}
