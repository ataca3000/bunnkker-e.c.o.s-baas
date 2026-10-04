const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /--sanjose-blue-dark/g, to: '--bunkker-primary-dark' },
  { from: /--sanjose-blue/g, to: '--bunkker-primary' },
  { from: /--sanjose-gray-dark/g, to: '--bunkker-surface' },
  { from: /--sanjose-gray-light/g, to: '--bunkker-text-muted' },
  { from: /--saas-primary/g, to: '--bunkker-primary' },
  { from: /--saas-accent/g, to: '--bunkker-accent' },
  { from: /--terraform-ink/g, to: '--bunkker-ink' },
  { from: /--terraform-surface/g, to: '--bunkker-surface' },
  { from: /--terraform-paper/g, to: '--bunkker-paper' },
  { from: /--terraform-teal/g, to: '--bunkker-teal' },
  { from: /--terraform-line/g, to: '--bunkker-line' },
  { from: /--terraform-muted/g, to: '--bunkker-muted' },
  { from: /btn-sanjose-secondary/g, to: 'bunkker-btn-secondary' },
  { from: /btn-sanjose/g, to: 'bunkker-btn' },
  { from: /card-sanjose/g, to: 'bunkker-card' },
  { from: /heading-sanjose/g, to: 'bunkker-heading' },
  { from: /terraform-shell/g, to: 'bunkker-shell' }
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      for (const replacement of replacements) {
        content = content.replace(replacement.from, replacement.to);
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, '..', 'src'));
console.log('Theme replacement complete.');
