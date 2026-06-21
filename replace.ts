import fs from 'fs';

const files = ['./App.tsx', './components/Sidebar.tsx', './components/Messaging.tsx'];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/trangray/g, 'translate');
  fs.writeFileSync(file, content);
});
