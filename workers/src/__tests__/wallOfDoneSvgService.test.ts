import { describe, expect, it } from 'vitest';
import type { CompletedPosterData } from '../services/completedPosterService';
import {
  generateSignalMicroBarsSvg,
  generateTiledA4Svgs,
  generateWallOfDoneSvg,
  MASTER_BANNER_HEIGHT,
  MASTER_BANNER_VIEWBOX,
  MASTER_BANNER_WIDTH,
} from '../services/wallOfDoneSvgService';

describe('wallOfDoneSvgService', () => {
  const mockPosterData: CompletedPosterData = {
    totalCount: 4,
    generatedAt: '2026-09-14T10:00:00Z',
    tiers: [
      {
        tierIndex: 0,
        columns: [
          [
            {
              id: '1',
              title: 'Family trip booking & coordination',
              reason: 'Keep kids active',
              category: 'Personal',
              size: 3,
              completedAt: '2025-11-13T12:00:00Z',
              dateFormatted: "13th Nov '25",
              dateDay: '13',
              dateSuffix: 'th',
              dateMonthYear: "Nov '25",
              dateHtml: '13<sup>th</sup> Nov',
              epicTitle: 'FAMILY HOLIDAYS',
              goalTitle: 'Be great to family',
              goalIcon: '👨‍👩‍👦',
            },
          ],
          [],
          [],
          [
            {
              id: '2',
              title: 'Tackle bag overhaul',
              category: 'Caving Crew',
              size: 4,
              completedAt: '2025-11-14T12:00:00Z',
              dateFormatted: "14th Nov '25",
              dateDay: '14',
              dateSuffix: 'th',
              dateMonthYear: "Nov '25",
              dateHtml: '14<sup>th</sup> Nov',
            },
          ],
        ],
      },
      {
        tierIndex: 1,
        columns: [
          [
            {
              id: '3',
              title: 'Dentist follow up',
              category: 'Personal',
              size: 2,
              completedAt: '2026-03-01T12:00:00Z',
              dateFormatted: "1st Mar '26",
              dateDay: '1',
              dateSuffix: 'st',
              dateMonthYear: "Mar '26",
              dateHtml: '1<sup>st</sup> Mar',
            },
          ],
          [],
          [],
          [],
        ],
      },
      {
        tierIndex: 2,
        columns: [[], [], [], []],
      },
    ],
  };

  describe('generateSignalMicroBarsSvg', () => {
    it('generates solid black filled micro-bars corresponding to size 1 to 5', () => {
      // Size 1 -> 1 bar
      const bar1 = generateSignalMicroBarsSvg(10, 20, 1);
      const rectCount1 = (bar1.match(/<rect/g) || []).length;
      expect(rectCount1).toBe(1);
      expect(bar1).toContain('fill="#000000"');
      expect(bar1).toContain('rx="0.5"');

      // Size 3 -> 3 bars
      const bar3 = generateSignalMicroBarsSvg(10, 20, 3);
      const rectCount3 = (bar3.match(/<rect/g) || []).length;
      expect(rectCount3).toBe(3);

      // Size 5 -> 5 bars
      const bar5 = generateSignalMicroBarsSvg(10, 20, 5);
      const rectCount5 = (bar5.match(/<rect/g) || []).length;
      expect(rectCount5).toBe(5);
    });
  });

  describe('generateWallOfDoneSvg', () => {
    it('generates valid full-banner monochrome vector SVG with exact dimensions and viewbox', () => {
      const svg = generateWallOfDoneSvg(mockPosterData);

      expect(svg).toContain('<svg');
      expect(svg).toContain(`viewBox="${MASTER_BANNER_VIEWBOX}"`);
      expect(svg).toContain(`width="${MASTER_BANNER_WIDTH}"`);
      expect(svg).toContain(`height="${MASTER_BANNER_HEIGHT}"`);
      expect(svg).toContain('Family trip booking');
      expect(svg).toContain('FAMILY HOLIDAYS');
      expect(svg).toContain('Tackle bag overhaul');
      expect(svg).toContain('CAVING CREW');
      expect(svg).toContain('PERSONAL');
      expect(svg).toContain('</svg>');
    });

    it('escapes XML special characters in titles, reasons and tags', () => {
      const dangerousData: CompletedPosterData = {
        totalCount: 1,
        generatedAt: '2026-09-14T10:00:00Z',
        tiers: [
          {
            tierIndex: 0,
            columns: [
              [
                {
                  id: 'xss',
                  title: 'Task <script>alert("hack")</script> & "quotes"',
                  reason: 'Reason with <evil> & tags',
                  category: 'Personal',
                  size: 5,
                  completedAt: '2025-11-13T12:00:00Z',
                  dateFormatted: "13th Nov '25",
                  dateDay: '13',
                  dateSuffix: 'th',
                  dateMonthYear: "Nov '25",
                  dateHtml: '13<sup>th</sup> Nov',
                  epicTitle: 'EPIC <A>',
                  goalTitle: 'GOAL <B>',
                  goalIcon: '⚠️',
                },
              ],
              [],
              [],
              [],
            ],
          },
          { tierIndex: 1, columns: [[], [], [], []] },
          { tierIndex: 2, columns: [[], [], [], []] },
        ],
      };

      const svg = generateWallOfDoneSvg(dangerousData);
      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
      expect(svg).toContain('EPIC &lt;A&gt;');
      expect(svg).toContain('GOAL &lt;B&gt;');
    });

    it('includes horizontal refresher headers across tiers 2 and 3', () => {
      const svg = generateWallOfDoneSvg(mockPosterData);
      expect(svg).toContain('PERSONAL (CONT.)');
    });
  });

  describe('generateTiledA4Svgs', () => {
    it('generates 6 distinct A4 SVG tiles with registration marks and cut guides', () => {
      const tiles = generateTiledA4Svgs(mockPosterData);
      expect(tiles).toHaveLength(6);

      // Tile 1 to 6
      expect(tiles[0].sheetIndex).toBe(1);
      expect(tiles[0].label).toBe('Sheet 1 of 6 (Tier 1 - Left)');
      expect(tiles[0].svg).toContain('+ P1');
      expect(tiles[0].svg).toContain('<svg');

      expect(tiles[5].sheetIndex).toBe(6);
      expect(tiles[5].label).toBe('Sheet 6 of 6 (Tier 3 - Right)');
      expect(tiles[5].svg).toContain('+ P6');
    });
  });
});
