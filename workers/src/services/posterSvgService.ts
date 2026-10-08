/**
 * XML escape helper to avoid XSS / SVG XML parsing errors
 */
export function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function wrapTextTspan(
  text: string,
  maxCharsPerLine: number,
  startX: number,
  dyEm = 1.2
): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines
    .map((line, idx) => {
      const dy = idx === 0 ? '0' : `${dyEm}em`;
      return `<tspan x="${startX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');
}

export interface GoalItem {
  id: string;
  type: 'aim' | 'focus' | 'value' | 'housekeeping';
  title: string;
  description?: string | null;
  icon?: string | null;
  orderIndex?: number;
  isActive?: boolean;
}

export interface PosterData {
  aims?: GoalItem[];
  focuses?: GoalItem[];
  values?: GoalItem[];
  housekeeping?: GoalItem[];
}

function wrapText(text: string, maxCharsPerLine = 24): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function generatePosterSvg(data: PosterData = {}): string {
  const aims = (data.aims || []).slice(0, 3);
  const focuses = (data.focuses || []).slice(0, 4);
  const values = (data.values || []).slice(0, 6);
  const housekeeping = data.housekeeping || [];

  // Placeholders for people who haven't set goals yet. Never put anyone's real goals here:
  // this poster is shown to every user.
  const defaultAims = [
    { icon: '🎯', title: 'Set your aims on the Goals page' },
    { icon: '🎯', title: '' },
    { icon: '🎯', title: '' },
  ];

  const defaultFocuses = [{ icon: '📌', title: 'Set your current focuses on the Goals page' }];

  const defaultValues = [
    {
      title: 'Your values',
      description: 'Add the values you want to live by on the Goals page.',
    },
  ];

  // Aims outer container is x=20, width=380. Inner usable span with 12px margin is 356px.
  // 3 boxes of width 110 with 13px gap:
  // Box 1: x = 32, center = 87
  // Box 2: x = 155, center = 210
  // Box 3: x = 278, center = 333 (ends at 388, well within 400)
  const aimCoords = [
    { rectX: 32, textX: 87, width: 110 },
    { rectX: 155, textX: 210, width: 110 },
    { rectX: 278, textX: 333, width: 110 },
  ];

  let aimsSvg = '';
  for (let i = 0; i < 3; i++) {
    const aim = aims[i] || defaultAims[i];
    const coords = aimCoords[i];
    const icon = aim.icon || defaultAims[i]?.icon || '🎯';
    const title = aim.title || defaultAims[i]?.title || '';
    const tspans = wrapTextTspan(title, 19, coords.textX, 1.25);

    aimsSvg += `
  <!-- Aim ${i + 1} -->
  <rect
     x="${coords.rectX}"
     y="105"
     width="${coords.width}"
     height="48"
     fill="white"
     stroke="#666"
     stroke-width="0.5"
     rx="4" />
  <text
     x="${coords.textX}"
     y="120"
     text-anchor="middle"
     font-family="Ubuntu, sans-serif"
     font-size="16"
     fill="#333">${escapeXml(icon)}</text>
  <text
     x="${coords.textX}"
     y="133"
     text-anchor="middle"
     font-family="Ubuntu, sans-serif"
     font-size="8"
     fill="#333">${tspans}</text>`;
  }

  let focusesSvg = '';
  const focusItems = focuses.length > 0 ? focuses : defaultFocuses;
  for (let i = 0; i < Math.min(focusItems.length, 4); i++) {
    const item = focusItems[i];
    const yPos = 217 + i * 13.5;
    const iconPrefix = item.icon ? `${item.icon} ` : '';
    const fullText = `${iconPrefix}${item.title}`;
    const tspans = wrapTextTspan(fullText, 70, 50, 1.2);
    focusesSvg += `
  <text
     x="50"
     y="${yPos}"
     font-family="Ubuntu, sans-serif"
     font-size="8.5"
     fill="#333">${tspans}</text>`;
  }

  let valuesSvg = '';
  const valueItems = values.length > 0 ? values : defaultValues;
  for (let i = 0; i < Math.min(valueItems.length, 6); i++) {
    const item = valueItems[i];
    const y = 313 + i * 41.5;
    const title = item.title.startsWith(`${i + 1})`) ? item.title : `${i + 1}) ${item.title}`;
    const descTspans = wrapTextTspan(item.description || '', 42, 38, 1.22);

    valuesSvg += `
  <!-- Value ${i + 1} -->
  <rect
     x="28"
     y="${y}"
     width="168"
     height="39.5"
     fill="white"
     stroke="#666"
     stroke-width="0.5"
     rx="3" />
  <rect
     x="28"
     y="${y}"
     width="4"
     height="39.5"
     fill="#333"
     rx="2" />
  <text
     x="38"
     y="${y + 11}"
     font-family="Ubuntu, sans-serif"
     font-size="8.5"
     font-weight="bold"
     fill="#333">${escapeXml(title)}</text>
  <text
     x="38"
     y="${y + 20}"
     font-family="Ubuntu, sans-serif"
     font-size="5.8"
     fill="#555">${descTspans}</text>`;
  }

  const hkBoxes = [
    {
      title: 'Weekly',
      x: 221,
      y: 315,
      w: 84,
      h: 85,
      defaultDesc: '',
    },
    {
      title: 'Monthly',
      x: 310,
      y: 315,
      w: 84,
      h: 85,
      defaultDesc: '',
    },
    {
      title: 'Every Few Months',
      x: 221,
      y: 408,
      w: 84,
      h: 52,
      defaultDesc: '',
    },
    {
      title: 'Daily Personal',
      x: 310,
      y: 408,
      w: 84,
      h: 52,
      defaultDesc: '',
    },
    {
      title: 'Daily Shared',
      x: 221,
      y: 468,
      w: 84,
      h: 87,
      defaultDesc: '',
    },
    {
      title: 'Child Care',
      x: 310,
      y: 468,
      w: 84,
      h: 87,
      defaultDesc: '',
    },
  ];

  let housekeepingSvg = '';
  for (let i = 0; i < hkBoxes.length; i++) {
    const box = hkBoxes[i];
    const item =
      housekeeping.find((h) => h.title.toLowerCase() === box.title.toLowerCase()) ||
      housekeeping[i];
    const sectionTitle = item?.title || box.title;
    const body = item?.description || box.defaultDesc;

    const rawLines = body.split('\n');
    let taskTextSvg = '';
    let currentY = box.y + 22;

    for (const rawLine of rawLines) {
      if (currentY > box.y + box.h - 4) break;
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      const formattedLine = trimmed.startsWith('▸') ? trimmed : `▸ ${trimmed}`;
      const wrapped = wrapText(formattedLine, 30);
      for (let wIdx = 0; wIdx < wrapped.length; wIdx++) {
        if (currentY > box.y + box.h - 4) break;
        const wl = wrapped[wIdx];
        const indent = wIdx === 0 ? 4 : 7;
        taskTextSvg += `
  <text
     x="${box.x + indent}"
     y="${currentY}"
     font-family="Ubuntu, sans-serif"
     font-size="5"
     fill="#333">${escapeXml(wl)}</text>`;
        currentY += 6.8;
      }
    }

    housekeepingSvg += `
  <!-- ${escapeXml(sectionTitle)} -->
  <rect
     x="${box.x}"
     y="${box.y}"
     width="${box.w}"
     height="${box.h}"
     fill="white"
     stroke="#666"
     stroke-width="0.5"
     rx="3" />
  <rect
     x="${box.x}"
     y="${box.y}"
     width="${box.w}"
     height="15"
     fill="#e8e8e8"
     stroke="#666"
     stroke-width="0.5"
     rx="3" />
  <text
     x="${box.x + box.w / 2}"
     y="${box.y + 10}"
     text-anchor="middle"
     font-family="Ubuntu, sans-serif"
     font-size="8"
     fill="#333">${escapeXml(sectionTitle)}</text>${taskTextSvg}`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   viewBox="0 0 420 594"
   style="background: white;"
   version="1.1"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <!-- A2 size: 420mm x 594mm -->
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&amp;display=swap');
    </style>
  </defs>
  <!-- Header -->
  <rect
     x="20"
     y="10"
     width="380"
     height="50"
     fill="#f8f8f8"
     stroke="#333"
     stroke-width="0.5"
     rx="8" />
  <text
     x="210"
     y="44"
     text-anchor="middle"
     font-family="Ubuntu, sans-serif"
     font-size="24px"
     fill="#333333">What I'm Working Towards</text>
  <!-- Top Aims Section -->
  <rect
     x="20"
     y="75"
     width="380"
     height="85"
     fill="#e8e8e8"
     stroke="#333"
     stroke-width="1"
     rx="8" />
  <text
     x="210"
     y="95"
     text-anchor="middle"
     font-family="Ubuntu, sans-serif"
     font-size="16"
     fill="#333">Aims</text>${aimsSvg}
  <!-- Current Focus Section -->
  <rect
     x="20"
     y="175"
     width="380"
     height="95"
     fill="#ddd"
     stroke="#333"
     stroke-width="1"
     rx="8" />
  <text
     x="210"
     y="195"
     text-anchor="middle"
     font-family="Ubuntu, sans-serif"
     font-size="16"
     fill="#333">Focuses</text>
  <rect
     x="35"
     y="205"
     width="350"
     height="55"
     fill="white"
     stroke="#666"
     stroke-width="0.5"
     rx="4" />${focusesSvg}
  <!-- Main Content Section -->
  <!-- Core Values -->
  <rect
     x="20"
     y="285"
     width="185"
     height="280"
     fill="#f5f5f5"
     stroke="#333"
     stroke-width="1"
     rx="8" />
  <rect
     x="20"
     y="285"
     width="185"
     height="25"
     fill="#e0e0e0"
     stroke="#333"
     stroke-width="1"
     rx="8" />
  <text
     x="112"
     y="302"
     text-anchor="middle"
     font-family="Ubuntu, sans-serif"
     font-size="14"
     fill="#333">Core Values</text>${valuesSvg}
  <!-- Regular Tasks Section -->
  <rect
     x="215"
     y="285"
     width="185"
     height="280"
     fill="#f5f5f5"
     stroke="#333"
     stroke-width="1"
     rx="8" />
  <rect
     x="215"
     y="285"
     width="185"
     height="25"
     fill="#e0e0e0"
     stroke="#333"
     stroke-width="1"
     rx="8" />
  <text
     x="307"
     y="302"
     text-anchor="middle"
     font-family="Ubuntu, sans-serif"
     font-size="14"
     fill="#333">Regular Tasks</text>${housekeepingSvg}
  <!-- Decorative border -->
  <rect
     x="5"
     y="5"
     width="410"
     height="584"
     fill="none"
     stroke="#333"
     stroke-width="2"
     rx="10" />
</svg>`;
}

export interface PosterTile {
  sheetIndex: number;
  label: string;
  row: number;
  col: number;
  svg: string;
}

/**
 * Splits an A2 poster SVG (420mm x 594mm) into a 2x2 grid of 4x A4 portrait sheets (210mm x 297mm each)
 */
export function generateTiled4xA4Svgs(masterSvg: string, posterTitle = 'Poster'): PosterTile[] {
  const SHEET_W = 210;
  const SHEET_H = 297;
  const tiles: PosterTile[] = [];

  const innerContent = masterSvg
    .replace(/<\?xml.*?\?>/, '')
    .replace(/<svg[^>]*>/, '')
    .replace(new RegExp('</' + 'svg>', 'g'), '');

  let index = 1;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const sheetIndex = index++;
      const originX = c * SHEET_W;
      const originY = r * SHEET_H;
      const positionLabel = `${r === 0 ? 'Top' : 'Bottom'} ${c === 0 ? 'Left' : 'Right'}`;
      const label = `Sheet ${sheetIndex} of 4 (${positionLabel})`;

      const regTag = `+ P${sheetIndex}`;
      const safeTitle = escapeXml(posterTitle);
      const safeLabel = escapeXml(label);
      const regMarks = `
      <text x="10" y="15" font-family="-apple-system, sans-serif" font-size="4" font-weight="bold" fill="#888">${regTag} [${safeTitle} - ${safeLabel}]</text>
      <text x="${SHEET_W - 10}" y="15" text-anchor="end" font-family="-apple-system, sans-serif" font-size="4" font-weight="bold" fill="#888">${regTag}</text>
      <text x="10" y="${SHEET_H - 10}" font-family="-apple-system, sans-serif" font-size="4" font-weight="bold" fill="#888">${regTag}</text>
      <text x="${SHEET_W - 10}" y="${SHEET_H - 10}" text-anchor="end" font-family="-apple-system, sans-serif" font-size="4" font-weight="bold" fill="#888">${regTag}</text>`;

      const tileSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_W} ${SHEET_H}" width="${SHEET_W}mm" height="${SHEET_H}mm">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&amp;display=swap');
    </style>
  </defs>
  <rect x="0" y="0" width="${SHEET_W}" height="${SHEET_H}" fill="#FFFFFF" />
  <g transform="translate(-${originX}, -${originY})">
    ${innerContent}
  </g>
  ${regMarks}
</svg>`;

      tiles.push({
        sheetIndex,
        label,
        row: r + 1,
        col: c + 1,
        svg: tileSvg,
      });
    }
  }

  return tiles;
}
