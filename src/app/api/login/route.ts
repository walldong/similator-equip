/**
 * 用户登录 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

interface UserRow {
  id: number;
  username: string;
  uuid: string;
  level: number;
  exp: number;
  gold: number;
  current_hp: number;
}

interface EquipmentRow {
  id: number;
  slot: string;
  level: number;
  quality: string;
  is_broken: number;
  equipped: number;
  main_affix_stat: string | null;
  main_affix_value: number;
  sub_affixes: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || !username.trim()) {
      return NextResponse.json({ success: false, message: '用户名不能为空' }, { status: 400 });
    }

    const trimmedName = username.trim();
    const db = getDatabase();

    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(trimmedName) as UserRow | undefined;

    if (!user) {
      return NextResponse.json({ success: false, message: '用户不存在，请先注册' }, { status: 404 });
    }

    // 更新登录时间
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // 获取装备数据
    const equipments = db.prepare('SELECT * FROM equipments WHERE user_id = ?').all(user.id) as EquipmentRow[];

    const mappedEquipments = equipments.map((row) => ({
      id: row.id,
      slot: row.slot,
      level: row.level,
      quality: row.quality,
      isBroken: row.is_broken === 1,
      equipped: row.equipped === 1,
      mainAffix: {
        stat: row.main_affix_stat,
        value: row.main_affix_value,
      },
      subAffixes: JSON.parse(row.sub_affixes || '[]'),
    }));

    // 计算玩家属性
    const baseAtk = 50 + user.level * 10;
    const baseDef = 30 + user.level * 5;
    const baseSpd = 20 + user.level * 2;
    const maxHp = 200 + user.level * 50;

    return NextResponse.json({
      success: true,
      message: '登录成功',
      data: {
        id: user.id,
        username: user.username,
        uuid: user.uuid,
        level: user.level,
        exp: user.exp,
        gold: user.gold,
        currentHp: user.current_hp,
        maxHp,
        stats: {
          atk: baseAtk,
          def: baseDef,
          spd: baseSpd,
          critRate: 0,
          critDmg: 0,
        },
        equipments: mappedEquipments,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}