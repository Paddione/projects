const {packAsync} = require('free-tex-packer-core');
const fs = require('fs');
const path = require('path');

function collectPngs(dir, prefix) {
  prefix = prefix || '';
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const namePrefix = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectPngs(fullPath, namePrefix));
    } else if (entry.name.endsWith('.png')) {
      results.push({filePath: fullPath, name: namePrefix});
    }
  }
  return results;
}

const pngs = collectPngs('assets/renders/items');
console.log('Found PNGs:', pngs.length);
console.log('Sample names:', pngs.slice(0,3).map(p => p.name));

const images = pngs.map(({filePath, name}) => ({path: name, contents: fs.readFileSync(filePath)}));
packAsync(images, {textureName: 'items', width: 512, height: 512, detectIdentical: false, exporter: 'JsonHash', removeFileExtension: true}).then(results => {
  for (const r of results) {
    if (r.name.endsWith('.json')) {
      const d = JSON.parse(r.buffer.toString());
      console.log('Frame keys:', Object.keys(d.frames));
    }
  }
}).catch(console.error);
