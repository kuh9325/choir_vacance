import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GAME SCORE | 실시간 행사 점수판',
  description: '2026 가을 실내 게임데이 실시간 점수 입력 및 전광판',
  openGraph: { title: 'GAME SCORE | 실시간 행사 점수판', description: '우리 팀의 순간을 기록하다', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'GAME SCORE | 실시간 행사 점수판', description: '우리 팀의 순간을 기록하다', images: ['/og.png'] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
