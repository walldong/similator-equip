'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// 动态导入游戏组件（避免 SSR 问题）
const GameComponent = dynamic(() => import('@/app/components/Game'), { ssr: false });

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h1>⚔️ 装备强化模拟器</h1>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return <GameComponent />;
}