import { describe, expect, it } from 'vitest';
import { escapeXml, generatePosterSvg, wrapTextTspan } from '../services/posterSvgService';

describe('wrapTextTspan', () => {
  it('wraps long text into multiple tspans without truncating', () => {
    const text = 'Look after the people who matter and family';
    const tspans = wrapTextTspan(text, 20, 100, 1.2);
    expect(tspans).toContain('<tspan');
    expect(tspans).not.toContain('…');
    expect(tspans).toContain('family');
  });
});

describe('posterSvgService', () => {
  it('escapes XML special characters correctly', () => {
    expect(escapeXml(`Rock & Roll <script> "quote" 'single' >`)).toBe(
      'Rock &amp; Roll &lt;script&gt; &quot;quote&quot; &apos;single&apos; &gt;'
    );
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
  });

  it('generates standard A2 SVG poster with default data', () => {
    const svg = generatePosterSvg({});
    expect(svg).toContain('viewBox="0 0 420 594"');
    expect(svg).toContain("What I'm Working Towards");
    expect(svg).toContain('Aims');
    expect(svg).toContain('Focuses');
    expect(svg).toContain('Core Values');
    expect(svg).toContain('Regular Tasks');
    expect(svg).toContain('Your values');
    // Defaults are shown to every user, so they are neutral placeholders, never real goals
    expect(svg).toContain('Set your aims');
    expect(svg).toContain('Your values');
  });

  it('renders complete untruncated aim titles with multi-line tspans', () => {
    const svg = generatePosterSvg({
      aims: [
        {
          id: '1',
          type: 'aim',
          title: 'Look after the people who matter and family',
          icon: '👨‍👩‍👦',
        },
      ],
    });
    expect(svg).toContain('family');
    expect(svg).not.toContain('Look after the people…');
  });

  it('injects live custom goals and escapes special characters', () => {
    const svg = generatePosterSvg({
      aims: [
        {
          id: 'aim-1',
          type: 'aim',
          title: 'Family & Loved Ones <3',
          icon: '💖',
        },
      ],
      focuses: [
        {
          id: 'focus-1',
          type: 'focus',
          title: 'Master TypeScript & Cloudflare',
          icon: '⚡',
        },
      ],
      values: [
        {
          id: 'val-1',
          type: 'value',
          title: 'Radical Candor & Growth',
          description: 'Speak truthfully & lovingly always',
        },
      ],
      housekeeping: [
        {
          id: 'hk-1',
          type: 'housekeeping',
          title: 'Weekly',
          description: `▸ Review budget & spend\n▸ Sync calendars`,
        },
      ],
    });

    expect(svg).toContain('Family &amp; Loved Ones');
    expect(svg).toContain('&lt;3');
    expect(svg).toContain('Master TypeScript &amp; Cloudflare');
    expect(svg).toContain('1) Radical Candor &amp; Growth');
    expect(svg).toContain('Speak truthfully &amp; lovingly always');
    expect(svg).toContain('Review budget &amp;');
    expect(svg).toContain('spend');
    expect(svg).toContain('Sync calendars');
  });
});
