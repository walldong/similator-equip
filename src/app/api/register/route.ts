/**
 * 用户注册 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, generateUUID } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || !username.trim()) {
      return NextResponse.json({ success: false, message: '用户名不能为空' }, { status: 400 });
    }

    const trimmedName = username.trim();

    // 验证用户名
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(trimmedName)) {
      return NextResponse.json({ success: false, message: '用户名只能包含字母、数字、下划线和中文' }, { status: 400 });
    }

    if (trimmedName.length > 20) {
      return NextResponse.json({ success: false, message: '用户名最长20个字符' }, { status: 400 });
    }

    const db = getDatabase();

    // 检查是否存在
    const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(trimmedName);
    if (existing) {
      return NextResponse.json({ success: false, message: '用户名已存在' }, { status: 400 });
    }

    // 创建用户
    const uuid = generateUUID();
    const result = db.prepare(`
      INSERT INTO users (username, uuid, level, exp, gold, current_hp)
      VALUES (?, ?, 1, 0, 100, 200)
    `).run(trimmedName, uuid);

    return NextResponse.json({
      success: true,
      message: '注册成功',
      data: {
        id: result.lastInsertRowid,
        username: trimmedName,
        uuid,
        level: 1,
        exp: 0,
        gold: 100,
        currentHp: 200,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}