/* Generates native launcher PNGs from the RentalHub vector brand geometry. */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const targets = [
  [48, 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png'], [48, 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png'],
  [72, 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png'], [72, 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png'],
  [96, 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png'], [96, 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png'],
  [144, 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png'], [144, 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png'],
  [192, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'], [192, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png'],
  [40, 'ios/RentalHub/Images.xcassets/AppIcon.appiconset/AppIcon-20@2x.png'], [60, 'ios/RentalHub/Images.xcassets/AppIcon.appiconset/AppIcon-20@3x.png'],
  [58, 'ios/RentalHub/Images.xcassets/AppIcon.appiconset/AppIcon-29@2x.png'], [87, 'ios/RentalHub/Images.xcassets/AppIcon.appiconset/AppIcon-29@3x.png'],
  [80, 'ios/RentalHub/Images.xcassets/AppIcon.appiconset/AppIcon-40@2x.png'], [120, 'ios/RentalHub/Images.xcassets/AppIcon.appiconset/AppIcon-40@3x.png'],
  [120, 'ios/RentalHub/Images.xcassets/AppIcon.appiconset/AppIcon-60@2x.png'], [180, 'ios/RentalHub/Images.xcassets/AppIcon.appiconset/AppIcon-60@3x.png'],
  [1024, 'ios/RentalHub/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png'],
];

const hex = (value) => value.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16));
const mix = (a, b, amount) => a.map((v, i) => Math.round(v + (b[i] - v) * amount));

function icon(size) {
  const png = new PNG({ width: size, height: size });
  const scale = size / 1024;
  const dark = hex('173728'), mid = hex('315B43'), light = hex('6DA27F');
  const put = (x, y, rgb, alpha = 1) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const at = (Math.floor(y) * size + Math.floor(x)) * 4;
    const base = [png.data[at], png.data[at + 1], png.data[at + 2]];
    const next = mix(base, rgb, alpha);
    png.data[at] = next[0]; png.data[at + 1] = next[1]; png.data[at + 2] = next[2]; png.data[at + 3] = 255;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const blend = ((x / size) + (y / size)) / 2;
    put(x, y, blend < .52 ? mix(dark, mid, blend / .52) : mix(mid, light, (blend - .52) / .48));
  }
  const circle = (cx, cy, r, color, alpha) => {
    [cx, cy, r] = [cx * scale, cy * scale, r * scale];
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(size - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(size - 1, Math.ceil(cx + r)); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) put(x, y, color, alpha);
  };
  const roundedRect = (left, top, width, height, radius, color, alpha) => {
    [left, top, width, height, radius] = [left * scale, top * scale, width * scale, height * scale, radius * scale];
    for (let y = Math.max(0, Math.floor(top)); y <= Math.min(size - 1, Math.ceil(top + height)); y++) for (let x = Math.max(0, Math.floor(left)); x <= Math.min(size - 1, Math.ceil(left + width)); x++) {
      const dx = Math.max(left + radius - x, 0, x - (left + width - radius));
      const dy = Math.max(top + radius - y, 0, y - (top + height - radius));
      if (dx * dx + dy * dy <= radius * radius) put(x, y, color, alpha);
    }
  };
  const line = (ax, ay, bx, by, width, color) => {
    [ax, ay, bx, by, width] = [ax * scale, ay * scale, bx * scale, by * scale, width * scale];
    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - width)), maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx) + width));
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - width)), maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by) + width));
    const vx = bx - ax, vy = by - ay, length = vx * vx + vy * vy;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const ratio = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / length));
      const dx = x - (ax + ratio * vx), dy = y - (ay + ratio * vy);
      if (dx * dx + dy * dy <= (width / 2) ** 2) put(x, y, [255, 255, 255]);
    }
  };
  const white = [255, 255, 255], mint = hex('A9D6B5');
  circle(834, 168, 286, hex('DDEBDD'), .11); circle(120, 910, 268, hex('DDEBDD'), .11);
  roundedRect(168, 168, 688, 688, 220, white, .15);
  line(276, 494, 512, 296, 62, white); line(512, 296, 748, 494, 62, white);
  line(351, 474, 351, 714, 62, white); line(673, 474, 673, 714, 62, white); line(351, 730, 673, 730, 62, white);
  line(458, 759, 458, 602, 62, white); line(566, 602, 566, 759, 62, white);
  circle(706, 348, 50, mint, 1); circle(706, 348, 28, white, 1);
  return png;
}

for (const [size, relative] of targets) {
  const output = path.join(root, relative);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, PNG.sync.write(icon(size)));
}
console.log(`Generated ${targets.length} RentalHub launcher icons.`);
