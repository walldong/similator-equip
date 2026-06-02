/**
 * 装备保存 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

interface Affix {
  stat: string;
  value: number;
}

interface Equipment {
  id: string | number;
  slot: string;
  level?: number;
  quality?: string;
  isBroken?: boolean;
  mainAffix?: Affix;
  subAffixes?: Affix[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, equipments, equippedSlots } = body as {
      userId: number;
      equipments: Equipment[];
      equippedSlots?: Record<string, string | number>;
    };

    if (!userId) {
      return NextResponse.json({ success: false, message: '缺少用户ID' }, { status: 400 });
    }

    const db = getDatabase();

    // 先删除所有旧装备
    db.prepare('DELETE FROM equipments WHERE user_id = ?').run(userId);

    // 批量插入新装备
    const stmt = db.prepare(`
      INSERT INTO equipments (user_id, slot, level, quality, is_broken, equipped, main_affix_stat, main_affix_value, sub_affixes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: Equipment[]) => {
      for (const eq of items) {
        const isEquipped = equippedSlots && Object.values(equippedSlots).includes(eq.id);
        stmt.run(
          userId,
          eq.slot,
          eq.level || 0,
          eq.quality || 'normal',
          eq.isBroken ? 1 : 0,
          isEquipped ? 1 : 0,
          eq.mainAffix?.stat || null,
          eq.mainAffix?.value || 0,
          JSON.stringify(eq.subAffixes || [])
        );
      }
    });

    insertMany(equipments || []);

    return NextResponse.json({ success: true, message: '装备保存成功' });
  } catch (error) {
    console.error('Equipment save error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}