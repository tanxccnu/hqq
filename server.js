/**
 * 华钦麒科技 品牌站本地服务
 * 功能：1) 静态站点服务；2) /api/consult 接收咨询需求并写入 CSV/TXT
 * 用法：node server.js
 * 默认端口：3000（可通过 PORT=xxxx 覆盖）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const CSV_FILE = path.join(ROOT, 'submissions.csv');
const TXT_FILE = path.join(ROOT, 'submissions.txt');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

function sanitize(str){
  return String(str == null ? '' : str).trim();
}

function initStorage(){
  try {
    if(!fs.existsSync(CSV_FILE)){
      fs.writeFileSync(CSV_FILE, '\ufeff时间,姓名,单位,电话,需求,补充说明\n', 'utf8');
    }
  } catch(e) {
    console.error('初始化 CSV 失败:', e.message);
  }
}

function appendRecord({ name, org, phone, need, note }){
  const now = new Date();
  const time = now.toLocaleString('zh-CN', { hour12: false });
  const csvLine = [time, name, org,  phone, need, note || '']
    .map(v => '"' + String(v).replace(/"/g, '""') + '"')
    .join(',') + '\n';
  fs.appendFileSync(CSV_FILE, csvLine, 'utf8');

  const txtLine = [
    '--- 咨询需求 ---',
    '时间：' + time,
    '姓名：' + name,
    '单位：' + org,
    '电话：' + phone,
    '需求：' + (need || '无'),
    '补充说明：' + (note || '无'),
    '----------------',
    ''
  ].join('\n');
  fs.appendFileSync(TXT_FILE, txtLine, 'utf8');
}

function sendJson(res, status, data){
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function serveStatic(req, res, filePath){
  fs.stat(filePath, function(err, stats){
    if(err || !stats.isFile()){
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function handleApi(req, res){
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => body += chunk);
  req.on('end', function(){
    try {
      const data = JSON.parse(body || '{}');
      const name = sanitize(data.name);
      const org = sanitize(data.org);
      const phone = sanitize(data.phone);
      const need = sanitize(data.need);
      const note = sanitize(data.note);

      if(!name) return sendJson(res, 400, { ok: false, message: '请填写姓名' });
      if(!org) return sendJson(res, 400, { ok: false, message: '请填写单位' });
      if(!/^1\d{10}$/.test(phone)) return sendJson(res, 400, { ok: false, message: '请填写正确的手机号' });

      appendRecord({ name, org, phone, need, note });
      sendJson(res, 200, { ok: true, message: '提交成功' });
    } catch(e) {
      sendJson(res, 400, { ok: false, message: '请求格式错误' });
    }
  });
}

const server = http.createServer(function(req, res){
  if(req.method === 'OPTIONS'){
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsed = new URL(req.url, 'http://localhost');
  const pathname = parsed.pathname;

  if(req.method === 'POST' && pathname === '/api/consult'){
    return handleApi(req, res);
  }

  let filePath = path.join(ROOT, decodeURIComponent(pathname));
  if(pathname === '/') filePath = path.join(ROOT, '华钦麒科技-宣传页面.html');
  if(fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()){
    filePath = path.join(filePath, 'index.html');
  }

  serveStatic(req, res, filePath);
});

initStorage();
server.listen(PORT, function(){
  console.log('华钦麒科技 品牌站服务已启动');
  console.log('访问地址：http://localhost:' + PORT);
  console.log('咨询需求将保存至：');
  console.log('  CSV：' + CSV_FILE);
  console.log('  TXT：' + TXT_FILE);
});
