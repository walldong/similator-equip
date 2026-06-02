/**
 * 游戏保存 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, data, equipments } = body;

    if (!userId) {
      return NextResponse.json({ success: false, message: '缺少用户ID' }, { status: 400 });
    }

    const db = getDatabase();

    // 更新用户数据
    db.prepare(`
      UPDATE users SET level = ?, exp = ?, gold = ?, current_hp = ? WHERE id = ?
    `).run(data.level, data.exp, data.gold, data.currentHp, userId);

    // 保存装备数据
    if (equipments && Array.isArray(equipments)) {
      // 先删除旧装备
      db.prepare('DELETE FROM equipments WHERE user_id = ?').run(userId);
      
      // 插入新装备
      const insertEquip = db.prepare(`
        INSERT INTO equipments (user_id, slot, level, quality, is_broken, equipped, main_affix_stat, main_affix_value, sub_affixes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const eq of equipments) {
        insertEquip.run(
          userId,
          eq.slot,
          eq.level || 0,
          eq.quality || 'normal',
          eq.isBroken ? 1 : 0,
          eq.equipped ? 1 : 0,
          eq.mainAffix?.stat || null,
          eq.mainAffix?.value || 0,
          JSON.stringify(eq.subAffixes || [])
        );
      }
    }

    return NextResponse.json({ success: true, message: '保存成功' });
  } catch (error) {
    console.error('Save error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}