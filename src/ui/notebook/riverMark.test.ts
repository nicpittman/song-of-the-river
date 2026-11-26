import { expect, it } from 'vitest';
import sharp from 'sharp';
import { riverSection } from './riverMark';

it('fills inside the riverbed, leaving the banks and ground below it dry at both display sizes', async () => {
  for (const size of [{ width: 120, height: 46, tiny: false }, { width: 26, height: 15, tiny: true }]) {
    for (const level of ['low', 'middle', 'high'] as const) {
      const svg = riverSection({ level, tomorrow: level, trend: 'steady', shifted: false, line: '' }, size)
        .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
        .replace('</svg>', '<style>.xs-water{fill:#bcd7d6}.xs-bank,.xs-grass{fill:none;stroke:none}</style></svg>');
      const { data, info } = await sharp(new TextEncoder().encode(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const pixel = (x: number, y: number): number[] => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
      const wetY = Math.floor(size.height * .81);
      expect(pixel(Math.floor(size.width / 2), wetY), `${level}, ${size.width}px: water inside channel`).toEqual([188, 215, 214, 255]);
      expect(pixel(Math.floor(size.width / 2), size.height - 1)[3], `${level}: below riverbed`).toBe(0);
      expect(pixel(0, wetY)[3], `${level}: outside bank`).toBe(0);
    }
  }
});
