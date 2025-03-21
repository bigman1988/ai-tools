# 部署指南

## 系统要求

- **Node.js**: v16.0.0 或更高版本
- **MySQL**: 5.7 或更高版本
- **Qdrant**: 向量数据库服务
- **Ollama**: 本地大语言模型服务

## 构建项目

在部署之前，先在本地构建项目：

```bash
# 安装依赖
npm install

# 构建前端项目
npm run build
```

构建完成后，`dist` 目录中会包含前端静态资源文件。

## 部署方案：使用 Node.js 部署

由于项目现在包含服务器组件（API服务、向量搜索等），必须使用 Node.js 进行部署。

### 1. 安装 Node.js
```bash
# 使用 nvm 安装 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 16  # 或更高版本
```

### 2. 安装 MySQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# CentOS
sudo yum install mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

配置 MySQL：
```bash
# 安全配置
sudo mysql_secure_installation

# 创建数据库和用户
mysql -u root -p
```

```sql
CREATE DATABASE translator;
CREATE USER 'translator_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON translator.* TO 'translator_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. 安装 Qdrant 向量数据库
```bash
# 使用 Docker 安装 Qdrant
docker pull qdrant/qdrant
docker run -d -p 6333:6333 -p 6334:6334 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant
```

### 4. 安装 Ollama
```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 拉取所需模型
ollama pull llama3
```

### 5. 安装 PM2 进程管理器
```bash
npm install -g pm2
```

### 6. 上传项目文件
```bash
# 创建目录
mkdir -p ~/ai-translate
cd ~/ai-translate

# 上传文件（从本地到服务器）
scp -r * .env user@your-server:~/ai-translate/
```

### 7. 配置环境变量
编辑 `.env` 文件，设置必要的环境变量：

```
# 数据库配置
DB_HOST=localhost
DB_USER=translator_user
DB_PASSWORD=your_password
DB_NAME=translator

# 服务配置
PORT=3000
NODE_ENV=production

# 向量数据库配置
QDRANT_URL=http://localhost:6333
OLLAMA_URL=http://localhost:11434
```

### 8. 安装依赖并启动服务器
```bash
# 安装依赖
npm install

# 使用 PM2 启动服务器
pm2 start src/app.js --name "ai-translate"

# 设置开机自启
pm2 startup
pm2 save
```

### 9. 配置 Nginx 作为反向代理（推荐）

安装 Nginx：
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS
sudo yum install epel-release
sudo yum install nginx
```

创建 Nginx 配置文件：
```bash
sudo nano /etc/nginx/sites-available/ai-translate
```

添加以下配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 启用 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
```

启用站点：
```bash
sudo ln -s /etc/nginx/sites-available/ai-translate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 10. 配置 HTTPS（推荐）

使用 Certbot 安装 SSL 证书：
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取并安装证书
sudo certbot --nginx -d your-domain.com
```

## 维护指南

### 查看日志
```bash
# 查看应用日志
pm2 logs ai-translate

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 更新应用
```bash
# 进入应用目录
cd ~/ai-translate

# 拉取最新代码（如果使用Git）
git pull

# 安装依赖
npm install

# 重启应用
pm2 restart ai-translate
```

### 数据库备份
```bash
# 备份数据库
mysqldump -u translator_user -p translator > backup_$(date +%Y%m%d).sql

# 备份向量数据库（如果使用Docker）
# 注意：Qdrant数据已挂载到主机，备份挂载目录即可
tar -czvf qdrant_backup_$(date +%Y%m%d).tar.gz ~/qdrant_data
```

### 故障排除

1. **应用无法启动**
   - 检查日志：`pm2 logs ai-translate`
   - 确认环境变量配置正确：`.env` 文件
   - 确认数据库连接正常：`mysql -u translator_user -p translator`

2. **向量搜索功能不工作**
   - 确认 Qdrant 服务运行正常：`curl http://localhost:6333/collections`
   - 检查 Ollama 服务状态：`curl http://localhost:11434/api/tags`

3. **性能问题**
   - 检查服务器资源使用情况：`htop`
   - 考虑增加服务器资源或优化数据库查询
