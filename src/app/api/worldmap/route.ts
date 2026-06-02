/**
 * 世界地图 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, message: '缺少用户ID' }, { status: 400 });
    }

    const db = getDatabase();
    const mapData = db.prepare('SELECT * FROM world_map WHERE user_id = ?').get(parseInt(userId));

    if (!mapData) {
      return NextResponse.json({ success: true, data: null });
    }

    const row = mapData as {
      width: number;
      height: number;
      tile_size: number;
      player_x: number;
      player_y: number;
      player_cell_x: number;
      player_cell_y: number;
      cells: string;
      stats: string;
    };

    return NextResponse.json({
      success: true,
      data: {
        width: row.width,
        height: row.height,
        tileSize: row.tile_size || 32,
        player: {
          x: row.player_x,
          y: row.player_y,
          cellX: row.player_cell_x,
          cellY: row.player_cell_y,
        },
        cells: JSON.parse(row.cells),
        stats: JSON.parse(row.stats),
      },
    });
  } catch (error) {
    console.error('WorldMap GET error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, data } = body;

    if (!userId || !data) {
      return NextResponse.json({ success: false, message: '缺少参数' }, { status: 400 });
    }

    const db = getDatabase();
    
    // 新格式: data.player 包含 x, y, cellX, cellY
    const player = data.player || { x: 0, y: 0, cellX: 0, cellY: 0 };
    
    db.prepare(`
      INSERT INTO world_map (user_id, width, height, tile_size, player_x, player_y, player_cell_x, player_cell_y, cells, stats)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        width = ?, height = ?, tile_size = ?, 
        player_x = ?, player_y = ?, player_cell_x = ?, player_cell_y = ?, 
        cells = ?, stats = ?
    `).run(
      userId,
      data.width, data.height, data.tileSize || 32,
      player.x, player.y, player.cellX, player.cellY,
      JSON.stringify(data.cells), JSON.stringify(data.stats),
      // UPDATE 部分
      data.width, data.height, data.tileSize || 32,
      player.x, player.y, player.cellX, player.cellY,
      JSON.stringify(data.cells), JSON.stringify(data.stats)
    );

    return NextResponse.json({ success: true, message: '地图保存成功' });
  } catch (error) {
    console.error('WorldMap POST error:', error);
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 });
  }
}