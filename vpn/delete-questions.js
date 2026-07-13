const fs = require('fs');
const path = require('path');

const langDir = path.join(__dirname, 'lang');
const files = fs.readdirSync(langDir).filter(f => f.startsWith('questions-') && f.endsWith('.json'));

files.forEach(file => {
    const filePath = path.join(langDir, file);
    const arr = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // 第14、15个元素（1-indexed → 0-indexed: 13, 14）
    // 倒数第二个元素（index: arr.length - 2）
    const removeIndices = new Set([13, 14, arr.length - 2]);

    const filtered = arr.filter((_, i) => !removeIndices.has(i));

    fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2) + '\n', 'utf8');
    console.log(`${file}: ${arr.length} → ${filtered.length} (deleted indices: ${[...removeIndices].sort((a,b) => a-b).join(', ')})`);
});
