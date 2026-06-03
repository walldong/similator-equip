 ## 部署验证流程

 每次代码修改后，必须执行以下验证流程：

 1. 构建前端：
    ```bash
    cd /e/my-projects/similator-equip && npm run build
    ```

 2. 重新构建并部署 Docker：
    ```bash
    cd /e/my-projects/similator-equip && docker-compose -f docker-compose.test.yml down && docker build -f Dockerfile -t similator-equip:test . && docker-compose -f docker-compose.test.yml up -d
    ```

 3. 等待服务启动（约10秒）后验证常见接口：
    ```bash
    # 健康检查
    curl -s http://localhost:3000/api/health

    # 登录接口（用户账号：ces）
    curl -s -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"username":"ces"}'

    # 查看日志
    docker logs game-app 2>&1 | tail -2
 4. 验证成功后，将改动提交commit