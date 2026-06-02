import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '装备强化模拟器',
  description: '基于 ECS 架构的装备强化模拟器',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}