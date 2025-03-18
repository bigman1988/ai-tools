const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// 确保.env文件存在
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('创建默认.env文件...');
    const defaultEnv = `
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=translate_knowledge
PORT=3000
`;
    fs.writeFileSync(envPath, defaultEnv.trim());
    console.log('.env文件已创建，请根据需要修改数据库配置。');
}

console.log('正在启动API服务器...');
const server = exec('node src/server.js', (error, stdout, stderr) => {
    if (error) {
        console.error(`执行错误: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
});

server.stdout.on('data', (data) => {
    console.log(data.toString().trim());
});

server.stderr.on('data', (data) => {
    console.error(data.toString().trim());
});

// 创建readline接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n服务器已启动，按Ctrl+C终止服务器。');

// 处理用户输入
rl.on('line', (input) => {
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log('正在关闭服务器...');
        server.kill();
        rl.close();
    }
});

// 处理程序退出
process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    server.kill();
    rl.close();
    process.exit();
});
