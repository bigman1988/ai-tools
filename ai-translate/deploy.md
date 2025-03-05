# 部署指南

## 构建项目

在部署之前，先在本地构建项目：

```bash
# 安装依赖
npm install

# 构建项目
npm run build
```

构建完成后，`dist` 目录中会包含：
- `index.html`
- `main.[hash].js`
- `xlsx.[hash].js`
- 其他静态资源

## 方案一：使用 Nginx 部署（推荐）

### 1. 安装 Nginx
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS
sudo yum install epel-release
sudo yum install nginx
```

### 2. 创建网站目录
```bash
# 创建目录
sudo mkdir -p /var/www/translator
sudo chown -R $USER:$USER /var/www/translator
```

### 3. 上传文件
```bash
# 从本地上传构建文件
scp -r dist/* user@your-server:/var/www/translator/

# 上传环境配置文件
scp .env user@your-server:/var/www/translator/
```

### 4. 配置 Nginx

创建 Nginx 配置文件：
```bash
sudo nano /etc/nginx/sites-available/translator
```

添加以下配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    root /var/www/translator;
    index index.html;

    # 启用 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # 缓存设置
    location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 保护 .env 文件
    location ~ /\.env {
        deny all;
        return 404;
    }

    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
```

启用站点：
```bash
sudo ln -s /etc/nginx/sites-available/translator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. 配置 HTTPS（推荐）

使用 Certbot 安装 SSL 证书：
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取并安装证书
sudo certbot --nginx -d your-domain.com
```

### 6. 设置文件权限
```bash
# 设置目录权限
sudo chown -R www-data:www-data /var/www/translator
sudo chmod -R 755 /var/www/translator

# 保护 .env 文件
sudo chmod 600 /var/www/translator/.env
```

## 方案二：使用 Node.js 部署

### 1. 安装 Node.js
```bash
# 使用 nvm 安装 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 14  # 或更高版本
```

### 2. 安装 PM2
```bash
npm install -g pm2
```

### 3. 创建简单的服务器文件

在项目根目录创建 `server.js`：
```javascript
const express = require('express');
const path = require('path');
const app = express();

// 静态文件服务
app.use(express.static('dist'));

// 所有路由都返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
```

### 4. 上传文件
```bash
# 创建目录
mkdir -p ~/translator
cd ~/translator

# 上传文件
scp -r dist server.js package.json .env user@your-server:~/translator/
```

### 5. 安装依赖并启动服务器
```bash
# 安装依赖
npm install express

# 使用 PM2 启动服务器
pm2 start server.js --name "translator"

# 设置开机自启
pm2 startup
pm2 save
```

### 6. 配置反向代理（可选）

如果你想使用域名访问，还需要配置 Nginx 作为反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 维护指南

### 更新部署

#### Nginx 方式：
```bash
# 上传新的构建文件
scp -r dist/* user@your-server:/var/www/translator/

# 不需要重启 Nginx
```

#### Node.js 方式：
```bash
# 上传新的构建文件
scp -r dist/* user@your-server:~/translator/

# 重启应用
pm2 restart translator
```

### 查看日志

#### Nginx 日志：
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### Node.js 日志：
```bash
pm2 logs translator
```

### 故障排除

1. 网站无法访问：
   - 检查防火墙：`sudo ufw status`
   - 检查服务状态：
     - Nginx：`sudo systemctl status nginx`
     - Node.js：`pm2 status`
   - 检查日志文件

2. 翻译功能不工作：
   - 检查 `.env` 文件权限和内容
   - 检查浏览器控制台错误
   - 检查网络请求是否正常

3. 性能问题：
   - 检查服务器资源使用情况：`top` 或 `htop`
   - 检查 Nginx/Node.js 的错误日志
   - 考虑启用 gzip 压缩和浏览器缓存
