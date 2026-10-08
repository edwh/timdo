/**
 * @fileoverview Component to render projects or life goals as an SVG poster for printing.
 * @module components/TimDoPage/PrintableSvgPoster
 */
import { useId } from 'react';
import type { Goal } from '../../app/types/goal.types';
import type { Project } from '../../app/types/project.types';
import { generatePosterSvg } from '../../workers/src/services/posterSvgService';

// Configuration objects updated to match tims_projects_redesign.svg
const svgStylesConfig = {
  fontFamily: 'Arial, sans-serif',
  fontSizes: {
    title: 22,
    sectionTitle: 14,
    header: 8,
    content: 7,
    contentReason: 6,
    contentNotes: 5,
    contentDone: 5,
    star: 7,
  },
  colors: {
    black: '#000',
    white: '#fff',
    darkGrey: '#333',
    mediumGrey: '#666',
    lightGrey: '#999',
    veryLightGrey: '#ccc',
    doSectionTitleBg: '#333',
    delaySectionTitleBg: '#666',
    awaitingSectionTitleBg: '#888',
    doneSectionTitleBg: '#999',
    headerBg: '#f0f0f0',
    altRowBg: '#f8f8f8',
    lineStroke: '#ddd',
  },
};

const posterLayout = {
  widthMM: 420,
  heightMM: 594,
  viewBox: '0 0 420 594',
  contentArea: { x: 8, y: 8, width: 404, height: 578, borderRadius: 6 },
  title: {
    x: 210,
    y: 30,
    underline: { x1: 80, y1: 36, x2: 340, y2: 36, strokeWidth: 1 },
  },
  sectionsStartY: 45,
  sectionPadding: {
    top: 5,
    right: 5,
    bottom: 10,
    left: 5,
    titleBarToContent: 5,
  },
  defaultLineStrokeWidth: 0.3,
};

const doSectionLayout = {
  title: 'DO',
  titleBarHeight: 22,
  header: {
    height: 14,
    textYOffset: 9,
    columns: [
      { name: 'Project', x: 23 },
      { name: 'Reason', x: 128 },
      { name: 'Bigness', x: 213 },
      { name: 'Next first step / Notes', x: 258 },
    ],
  },
  item: { height: 10, textYOffset: 8 },
};

const delaySectionLayout = {
  title: 'DELAY',
  titleBarHeight: 22,
  columnGutter: 5,
  header: {
    height: 14,
    textYOffset: 9,
    columns: [
      { name: 'Project', relativeX: 3 },
      { name: 'Reason', relativeX: 115 },
    ],
  },
  item: { height: 8, textYOffset: 6 },
};

const awaitingSectionLayout = {
  title: 'AWAITING',
  titleBarHeight: 22,
  columnGutter: 5,
  header: {
    height: 14,
    textYOffset: 9,
    columns: [
      { name: 'Project', relativeX: 3 },
      { name: 'Returns', relativeX: 115 },
    ],
  },
  item: { height: 8, textYOffset: 6 },
};

const doneSectionLayout = {
  title: 'DONE',
  titleBarHeight: 22,
  columnGutter: 5,
  item: { height: 6, textYOffset: 4.5 },
};

const svgEmbeddedStyles = `
  .title {
    font-family: ${svgStylesConfig.fontFamily};
    font-size: ${svgStylesConfig.fontSizes.title}px;
    font-weight: bold;
    text-anchor: middle;
    fill: ${svgStylesConfig.colors.black};
    letter-spacing: 1px;
  }
  .border {
    fill: none;
    stroke: ${svgStylesConfig.colors.darkGrey};
    stroke-width: 1.5;
    rx: ${posterLayout.contentArea.borderRadius};
  }
  .line {
    stroke: ${svgStylesConfig.colors.lineStroke};
    stroke-width: ${posterLayout.defaultLineStrokeWidth};
  }
  .section-bg-dark { fill: ${svgStylesConfig.colors.doSectionTitleBg}; }
  .section-bg-med { fill: ${svgStylesConfig.colors.delaySectionTitleBg}; }
  .section-bg-awaiting { fill: ${svgStylesConfig.colors.awaitingSectionTitleBg}; }
  .section-bg-light { fill: ${svgStylesConfig.colors.doneSectionTitleBg}; }
  .header-bg { fill: ${svgStylesConfig.colors.headerBg}; }
  .alt-row { fill: ${svgStylesConfig.colors.altRowBg}; }

  .section-title {
    font-family: ${svgStylesConfig.fontFamily};
    font-size: ${svgStylesConfig.fontSizes.sectionTitle}px;
    font-weight: bold;
    fill: ${svgStylesConfig.colors.white};
    text-anchor: middle;
    dominant-baseline: middle;
  }
  .header {
    font-family: ${svgStylesConfig.fontFamily};
    font-size: ${svgStylesConfig.fontSizes.header}px;
    font-weight: bold;
    fill: ${svgStylesConfig.colors.black};
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .content {
    font-family: ${svgStylesConfig.fontFamily};
    font-size: ${svgStylesConfig.fontSizes.content}px;
    fill: ${svgStylesConfig.colors.black};
  }
  .content-reason {
    font-family: ${svgStylesConfig.fontFamily};
    font-size: ${svgStylesConfig.fontSizes.contentReason}px;
    fill: ${svgStylesConfig.colors.darkGrey};
    font-style: italic;
  }
  .content-notes {
    font-family: ${svgStylesConfig.fontFamily};
    font-size: ${svgStylesConfig.fontSizes.contentNotes}px;
    fill: ${svgStylesConfig.colors.mediumGrey};
  }
  .content-done {
    font-family: ${svgStylesConfig.fontFamily};
    font-size: ${svgStylesConfig.fontSizes.contentDone}px;
    fill: ${svgStylesConfig.colors.black};
  }
  .star-light { fill: ${svgStylesConfig.colors.veryLightGrey}; font-size: ${svgStylesConfig.fontSizes.star}px; }
  .star-dark { fill: ${svgStylesConfig.colors.mediumGrey}; font-size: ${svgStylesConfig.fontSizes.star}px; }
  .star-black { fill: ${svgStylesConfig.colors.black}; font-size: ${svgStylesConfig.fontSizes.star}px; font-weight: bold; }
`;

export interface PrintableSvgPosterProps {
  projects?: Project[];
  goals?: Goal[];
  user: string;
  mode?: 'tasks' | 'goals';
  customTitle?: string;
}

const sizeToNumber = (size: Project['size']): number => {
  switch (size) {
    case '*':
      return 1;
    case '**':
      return 2;
    case '***':
      return 3;
    case '****':
      return 4;
    case '*****':
      return 5;
    default:
      return 0;
  }
};

const formatAwaitUntil = (awaitUntil: string): string =>
  new Date(awaitUntil)
    .toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    })
    .replace('Sept', 'Sep');

const truncateSvgText = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;

const StarDisplaySvg: React.FC<{
  size: Project['size'];
  x: number;
  y: number;
}> = ({ size, x, y }) => {
  let filledCount = 0;
  let starClass = '';

  switch (size) {
    case '*':
      filledCount = 1;
      starClass = 'star-light';
      break;
    case '**':
      filledCount = 2;
      starClass = 'star-dark';
      break;
    case '***':
      filledCount = 3;
      starClass = 'star-dark';
      break;
    case '****':
      filledCount = 4;
      starClass = 'star-black';
      break;
    case '*****':
      filledCount = 5;
      starClass = 'star-black';
      break;
    default:
      filledCount = 0;
  }

  if (filledCount === 0) {
    return null;
  }

  return (
    <text x={x} y={y} className={starClass}>
      {'★'.repeat(filledCount)}
    </text>
  );
};

const PrintableSvgPoster: React.FC<PrintableSvgPosterProps> = ({
  projects = [],
  goals = [],
  user,
  mode = 'tasks',
  customTitle,
}) => {
  const titleId = useId();

  // If in life goals mode, render life goals poster layout via unified generator
  if (mode === 'goals') {
    const aims = goals.filter((g) => g.type === 'aim');
    const focuses = goals.filter((g) => g.type === 'focus');
    const values = goals.filter((g) => g.type === 'value');
    const housekeeping = goals.filter((g) => g.type === 'housekeeping');

    const svgMarkup = generatePosterSvg({
      aims: aims as any,
      focuses: focuses as any,
      values: values as any,
      housekeeping: housekeeping as any,
    });

    return (
      <div
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
        style={{ width: `${posterLayout.widthMM}mm`, height: `${posterLayout.heightMM}mm` }}
      />
    );
  }

  const svgTitleText = customTitle ? customTitle.toUpperCase() : `${user.toUpperCase()}'S PROJECTS`;
  let currentY = posterLayout.sectionsStartY;
  const sectionContentX = posterLayout.contentArea.x + posterLayout.sectionPadding.left;
  const sectionContentWidth =
    posterLayout.contentArea.width -
    posterLayout.sectionPadding.left -
    posterLayout.sectionPadding.right;

  const doProjects = projects
    .filter((p) => p.status === 'do')
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return sizeToNumber(a.size) - sizeToNumber(b.size);
    });

  const doSectionElements: React.JSX.Element[] = [];
  const doSectionStartY = currentY;

  doSectionElements.push(
    <rect
      key="do-title-bg"
      x={posterLayout.contentArea.x}
      y={currentY}
      width={posterLayout.contentArea.width}
      height={doSectionLayout.titleBarHeight}
      className="section-bg-dark"
    />,
    <text
      key="do-title"
      x={posterLayout.title.x}
      y={currentY + doSectionLayout.titleBarHeight / 2}
      className="section-title"
    >
      {doSectionLayout.title}
    </text>
  );
  currentY += doSectionLayout.titleBarHeight;
  currentY += posterLayout.sectionPadding.titleBarToContent;

  const doHeaderY = currentY;
  doSectionElements.push(
    <rect
      key="do-header-bg"
      x={sectionContentX}
      y={doHeaderY}
      width={sectionContentWidth}
      height={doSectionLayout.header.height}
      className="header-bg"
    />
  );
  for (const col of doSectionLayout.header.columns) {
    doSectionElements.push(
      <text
        key={`do-header-${col.name}`}
        x={col.x}
        y={doHeaderY + doSectionLayout.header.textYOffset}
        className="header"
      >
        {col.name}
      </text>
    );
  }
  currentY += doSectionLayout.header.height;

  for (const [index, project] of doProjects.entries()) {
    const itemRowY = currentY;
    doSectionElements.push(
      <rect
        key={`do-item-bg-${project.id}`}
        x={sectionContentX}
        y={itemRowY}
        width={sectionContentWidth}
        height={doSectionLayout.item.height}
        fill={index % 2 === 0 ? svgStylesConfig.colors.white : svgStylesConfig.colors.altRowBg}
      />,
      <text
        key={`do-item-proj-${project.id}`}
        x={doSectionLayout.header.columns[0].x}
        y={itemRowY + doSectionLayout.item.textYOffset}
        className="content"
      >
        {project.project}
      </text>,
      <text
        key={`do-item-reason-${project.id}`}
        x={doSectionLayout.header.columns[1].x}
        y={itemRowY + doSectionLayout.item.textYOffset}
        className="content-reason"
      >
        {project.reason}
      </text>,
      <StarDisplaySvg
        key={`do-item-stars-${project.id}`}
        size={project.size}
        x={doSectionLayout.header.columns[2].x}
        y={itemRowY + doSectionLayout.item.textYOffset}
      />,
      <text
        key={`do-item-notes-${project.id}`}
        x={doSectionLayout.header.columns[3].x}
        y={itemRowY + doSectionLayout.item.textYOffset}
        className="content-notes"
      >
        {project.notes || ''}
      </text>,
      <line
        key={`do-item-line-${project.id}`}
        x1={sectionContentX}
        y1={itemRowY + doSectionLayout.item.height}
        x2={sectionContentX + sectionContentWidth}
        y2={itemRowY + doSectionLayout.item.height}
        className="line"
      />
    );
    currentY += doSectionLayout.item.height;
  }
  currentY += posterLayout.sectionPadding.bottom;

  const doSectionTotalHeight = currentY - doSectionStartY;
  doSectionElements.unshift(
    <rect
      key="do-section-border"
      x={posterLayout.contentArea.x}
      y={doSectionStartY}
      width={posterLayout.contentArea.width}
      height={doSectionTotalHeight}
      fill={svgStylesConfig.colors.white}
      stroke={svgStylesConfig.colors.mediumGrey}
      strokeWidth="0.8"
      rx="4"
    />
  );

  const delaySectionElements: React.JSX.Element[] = [];
  const delaySectionStartY = currentY;

  const delayProjects = projects
    .filter((p) => p.status === 'delay')
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return sizeToNumber(a.size) - sizeToNumber(b.size);
    });

  delaySectionElements.push(
    <rect
      key="delay-title-bg"
      x={posterLayout.contentArea.x}
      y={currentY}
      width={posterLayout.contentArea.width}
      height={delaySectionLayout.titleBarHeight}
      className="section-bg-med"
    />,
    <text
      key="delay-title"
      x={posterLayout.title.x}
      y={currentY + delaySectionLayout.titleBarHeight / 2}
      className="section-title"
    >
      {delaySectionLayout.title}
    </text>
  );
  currentY += delaySectionLayout.titleBarHeight;
  currentY += posterLayout.sectionPadding.titleBarToContent;

  const delayHeaderY = currentY;
  const numDelayColumns = 2;
  const delayColumnTotalContentWidth =
    sectionContentWidth - (numDelayColumns - 1) * delaySectionLayout.columnGutter;
  const delayColumnWidth = delayColumnTotalContentWidth / numDelayColumns;

  const delayColumnXPositions = [
    sectionContentX,
    sectionContentX + delayColumnWidth + delaySectionLayout.columnGutter,
  ];

  for (let i = 0; i < numDelayColumns; i++) {
    delaySectionElements.push(
      <rect
        key={`delay-header-bg-${i}`}
        x={delayColumnXPositions[i]}
        y={delayHeaderY}
        width={delayColumnWidth}
        height={delaySectionLayout.header.height}
        className="header-bg"
      />
    );
    for (const col of delaySectionLayout.header.columns) {
      delaySectionElements.push(
        <text
          key={`delay-header-${col.name}-${i}`}
          x={delayColumnXPositions[i] + col.relativeX}
          y={delayHeaderY + delaySectionLayout.header.textYOffset}
          className="header"
        >
          {col.name}
        </text>
      );
    }
  }
  currentY += delaySectionLayout.header.height;

  const delayItemsStartY = currentY;
  let maxDelayItemY = delayItemsStartY;

  const midPointDelay = Math.ceil(delayProjects.length / numDelayColumns);
  const delayColumnProjects = [
    delayProjects.slice(0, midPointDelay),
    delayProjects.slice(midPointDelay),
  ];

  for (let colIdx = 0; colIdx < numDelayColumns; colIdx++) {
    let currentColumnItemY = delayItemsStartY;
    for (const [index, project] of delayColumnProjects[colIdx].entries()) {
      const itemRowY = currentColumnItemY;
      delaySectionElements.push(
        <rect
          key={`delay-item-bg-${project.id}`}
          x={delayColumnXPositions[colIdx]}
          y={itemRowY}
          width={delayColumnWidth}
          height={delaySectionLayout.item.height}
          fill={index % 2 === 0 ? svgStylesConfig.colors.white : svgStylesConfig.colors.altRowBg}
        />,
        <text
          key={`delay-item-proj-${project.id}`}
          x={delayColumnXPositions[colIdx] + delaySectionLayout.header.columns[0].relativeX}
          y={itemRowY + delaySectionLayout.item.textYOffset}
          className="content"
        >
          {project.project}
        </text>,
        <text
          key={`delay-item-reason-${project.id}`}
          x={delayColumnXPositions[colIdx] + delaySectionLayout.header.columns[1].relativeX}
          y={itemRowY + delaySectionLayout.item.textYOffset}
          className="content-reason"
        >
          {project.reason}
        </text>,
        <line
          key={`delay-item-line-${project.id}`}
          x1={delayColumnXPositions[colIdx]}
          y1={itemRowY + delaySectionLayout.item.height}
          x2={delayColumnXPositions[colIdx] + delayColumnWidth}
          y2={itemRowY + delaySectionLayout.item.height}
          className="line"
        />
      );
      currentColumnItemY += delaySectionLayout.item.height;
    }
    if (currentColumnItemY > maxDelayItemY) {
      maxDelayItemY = currentColumnItemY;
    }
  }
  currentY = maxDelayItemY + posterLayout.sectionPadding.bottom;

  if (numDelayColumns > 1 && delayProjects.length > 0) {
    delaySectionElements.push(
      <line
        key="delay-v-divider"
        x1={delayColumnXPositions[0] + delayColumnWidth + delaySectionLayout.columnGutter / 2}
        y1={delayHeaderY}
        x2={delayColumnXPositions[0] + delayColumnWidth + delaySectionLayout.columnGutter / 2}
        y2={maxDelayItemY}
        stroke={svgStylesConfig.colors.mediumGrey}
        strokeWidth="1"
      />
    );
  }

  const delaySectionTotalHeight = currentY - delaySectionStartY;
  delaySectionElements.unshift(
    <rect
      key="delay-section-border"
      x={posterLayout.contentArea.x}
      y={delaySectionStartY}
      width={posterLayout.contentArea.width}
      height={delaySectionTotalHeight}
      fill={svgStylesConfig.colors.white}
      stroke={svgStylesConfig.colors.mediumGrey}
      strokeWidth="0.8"
      rx="4"
    />
  );

  const awaitingProjects = projects
    .filter((p) => p.status === 'awaiting' && p.awaitUntil)
    .sort((a, b) => {
      const aDate = new Date(a.awaitUntil!).getTime();
      const bDate = new Date(b.awaitUntil!).getTime();

      if (aDate !== bDate) {
        return aDate - bDate;
      }
      return b.priority - a.priority;
    });

  const awaitingSectionElements: React.JSX.Element[] = [];

  if (awaitingProjects.length > 0) {
    const awaitingSectionStartY = currentY;

    awaitingSectionElements.push(
      <rect
        key="awaiting-title-bg"
        x={posterLayout.contentArea.x}
        y={currentY}
        width={posterLayout.contentArea.width}
        height={awaitingSectionLayout.titleBarHeight}
        className="section-bg-awaiting"
      />,
      <text
        key="awaiting-title"
        x={posterLayout.title.x}
        y={currentY + awaitingSectionLayout.titleBarHeight / 2}
        className="section-title"
      >
        {awaitingSectionLayout.title}
      </text>
    );
    currentY += awaitingSectionLayout.titleBarHeight;
    currentY += posterLayout.sectionPadding.titleBarToContent;

    const awaitingHeaderY = currentY;
    const numAwaitingColumns = 2;
    const awaitingColumnTotalContentWidth =
      sectionContentWidth - (numAwaitingColumns - 1) * awaitingSectionLayout.columnGutter;
    const awaitingColumnWidth = awaitingColumnTotalContentWidth / numAwaitingColumns;

    const awaitingColumnXPositions = [
      sectionContentX,
      sectionContentX + awaitingColumnWidth + awaitingSectionLayout.columnGutter,
    ];

    for (let i = 0; i < numAwaitingColumns; i++) {
      awaitingSectionElements.push(
        <rect
          key={`awaiting-header-bg-${i}`}
          x={awaitingColumnXPositions[i]}
          y={awaitingHeaderY}
          width={awaitingColumnWidth}
          height={awaitingSectionLayout.header.height}
          className="header-bg"
        />
      );
      for (const col of awaitingSectionLayout.header.columns) {
        awaitingSectionElements.push(
          <text
            key={`awaiting-header-${col.name}-${i}`}
            x={awaitingColumnXPositions[i] + col.relativeX}
            y={awaitingHeaderY + awaitingSectionLayout.header.textYOffset}
            className="header"
          >
            {col.name}
          </text>
        );
      }
    }
    currentY += awaitingSectionLayout.header.height;

    const awaitingItemsStartY = currentY;
    let maxAwaitingItemY = awaitingItemsStartY;

    const midPointAwaiting = Math.ceil(awaitingProjects.length / numAwaitingColumns);
    const awaitingColumnProjects = [
      awaitingProjects.slice(0, midPointAwaiting),
      awaitingProjects.slice(midPointAwaiting),
    ];

    for (let colIdx = 0; colIdx < numAwaitingColumns; colIdx++) {
      let currentColumnItemY = awaitingItemsStartY;
      for (const [index, project] of awaitingColumnProjects[colIdx].entries()) {
        const itemRowY = currentColumnItemY;
        awaitingSectionElements.push(
          <rect
            key={`awaiting-item-bg-${project.id}`}
            x={awaitingColumnXPositions[colIdx]}
            y={itemRowY}
            width={awaitingColumnWidth}
            height={awaitingSectionLayout.item.height}
            fill={index % 2 === 0 ? svgStylesConfig.colors.white : svgStylesConfig.colors.altRowBg}
          />,
          <text
            key={`awaiting-item-proj-${project.id}`}
            x={awaitingColumnXPositions[colIdx] + awaitingSectionLayout.header.columns[0].relativeX}
            y={itemRowY + awaitingSectionLayout.item.textYOffset}
            className="content"
          >
            {truncateSvgText(project.project, 24)}
          </text>,
          <text
            key={`awaiting-item-return-${project.id}`}
            x={awaitingColumnXPositions[colIdx] + awaitingSectionLayout.header.columns[1].relativeX}
            y={itemRowY + awaitingSectionLayout.item.textYOffset}
            className="content-reason"
          >
            {formatAwaitUntil(project.awaitUntil!)}
          </text>,
          <line
            key={`awaiting-item-line-${project.id}`}
            x1={awaitingColumnXPositions[colIdx]}
            y1={itemRowY + awaitingSectionLayout.item.height}
            x2={awaitingColumnXPositions[colIdx] + awaitingColumnWidth}
            y2={itemRowY + awaitingSectionLayout.item.height}
            className="line"
          />
        );
        currentColumnItemY += awaitingSectionLayout.item.height;
      }
      if (currentColumnItemY > maxAwaitingItemY) {
        maxAwaitingItemY = currentColumnItemY;
      }
    }
    currentY = maxAwaitingItemY + posterLayout.sectionPadding.bottom;

    awaitingSectionElements.push(
      <line
        key="awaiting-v-divider"
        x1={
          awaitingColumnXPositions[0] + awaitingColumnWidth + awaitingSectionLayout.columnGutter / 2
        }
        y1={awaitingHeaderY}
        x2={
          awaitingColumnXPositions[0] + awaitingColumnWidth + awaitingSectionLayout.columnGutter / 2
        }
        y2={maxAwaitingItemY}
        stroke={svgStylesConfig.colors.mediumGrey}
        strokeWidth="1"
      />
    );

    const awaitingSectionTotalHeight = currentY - awaitingSectionStartY;
    awaitingSectionElements.unshift(
      <rect
        key="awaiting-section-border"
        x={posterLayout.contentArea.x}
        y={awaitingSectionStartY}
        width={posterLayout.contentArea.width}
        height={awaitingSectionTotalHeight}
        fill={svgStylesConfig.colors.white}
        stroke={svgStylesConfig.colors.mediumGrey}
        strokeWidth="0.8"
        rx="4"
      />
    );
  }

  const doneSectionElements: React.JSX.Element[] = [];
  const doneSectionStartY = currentY;

  const doneProjects = projects
    .filter((p) => p.status === 'done')
    .sort((a, b) => {
      const aDate = a.statusLastChangedOn;
      const bDate = b.statusLastChangedOn;

      if (aDate && bDate) {
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      }
      if (aDate && !bDate) {
        return -1;
      }
      if (!aDate && bDate) {
        return 1;
      }
      return b.priority - a.priority;
    });

  doneSectionElements.push(
    <rect
      key="done-title-bg"
      x={posterLayout.contentArea.x}
      y={currentY}
      width={posterLayout.contentArea.width}
      height={doneSectionLayout.titleBarHeight}
      className="section-bg-light"
    />,
    <text
      key="done-title"
      x={posterLayout.title.x}
      y={currentY + doneSectionLayout.titleBarHeight / 2}
      className="section-title"
    >
      {doneSectionLayout.title}
    </text>
  );
  currentY += doneSectionLayout.titleBarHeight;

  const doneItemsStartY = currentY;
  let maxDoneItemY = doneItemsStartY;

  const numDoneColumns = 4;
  const doneColumnWidth =
    (sectionContentWidth - (numDoneColumns - 1) * doneSectionLayout.columnGutter) / numDoneColumns;

  const doneColumnXPositions = Array(numDoneColumns)
    .fill(null)
    .map((_, i) => sectionContentX + i * (doneColumnWidth + doneSectionLayout.columnGutter));

  const projectsPerDoneColumn = Math.ceil(doneProjects.length / numDoneColumns);
  const doneColumnProjects = Array(numDoneColumns)
    .fill(null)
    .map((_, colIdx) =>
      doneProjects.slice(colIdx * projectsPerDoneColumn, (colIdx + 1) * projectsPerDoneColumn)
    );

  for (let colIdx = 0; colIdx < numDoneColumns; colIdx++) {
    let currentColumnItemY = doneItemsStartY;
    for (const [index, project] of doneColumnProjects[colIdx].entries()) {
      const itemRowY = currentColumnItemY;
      doneSectionElements.push(
        <rect
          key={`done-item-bg-${project.id}`}
          x={doneColumnXPositions[colIdx]}
          y={itemRowY}
          width={doneColumnWidth}
          height={doneSectionLayout.item.height}
          fill={index % 2 === 0 ? svgStylesConfig.colors.white : svgStylesConfig.colors.altRowBg}
        />,
        <text
          key={`done-item-proj-${project.id}`}
          x={doneColumnXPositions[colIdx] + posterLayout.sectionPadding.left / 2}
          y={itemRowY + doneSectionLayout.item.textYOffset}
          className="content-done"
        >
          {project.project}
        </text>,
        <line
          key={`done-item-line-${project.id}`}
          x1={doneColumnXPositions[colIdx]}
          y1={itemRowY + doneSectionLayout.item.height}
          x2={doneColumnXPositions[colIdx] + doneColumnWidth}
          y2={itemRowY + doneSectionLayout.item.height}
          className="line"
        />
      );
      currentColumnItemY += doneSectionLayout.item.height;
    }
    if (currentColumnItemY > maxDoneItemY) {
      maxDoneItemY = currentColumnItemY;
    }
  }
  currentY = maxDoneItemY + posterLayout.sectionPadding.bottom;

  if (doneProjects.length > 0) {
    const dividerY1 = doneItemsStartY;
    const dividerY2 = maxDoneItemY;

    for (let i = 0; i < numDoneColumns - 1; i++) {
      doneSectionElements.push(
        <line
          key={`done-v-divider-${i}`}
          x1={doneColumnXPositions[i] + doneColumnWidth + doneSectionLayout.columnGutter / 2}
          y1={dividerY1}
          x2={doneColumnXPositions[i] + doneColumnWidth + doneSectionLayout.columnGutter / 2}
          y2={dividerY2}
          stroke={svgStylesConfig.colors.mediumGrey}
          strokeWidth="1"
        />
      );
    }
  }

  const doneSectionTotalHeight = currentY - doneSectionStartY;
  doneSectionElements.unshift(
    <rect
      key="done-section-border"
      x={posterLayout.contentArea.x}
      y={doneSectionStartY}
      width={posterLayout.contentArea.width}
      height={doneSectionTotalHeight}
      fill={svgStylesConfig.colors.white}
      stroke={svgStylesConfig.colors.mediumGrey}
      strokeWidth="0.8"
      rx="4"
    />
  );

  return (
    <svg
      width={`${posterLayout.widthMM}mm`}
      height={`${posterLayout.heightMM}mm`}
      viewBox={posterLayout.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      style={{ backgroundColor: svgStylesConfig.colors.white }}
      role="img"
    >
      <title id={titleId}>{`${svgTitleText} Poster`}</title>
      <defs>
        <style>{svgEmbeddedStyles}</style>
      </defs>

      <rect
        x={posterLayout.contentArea.x}
        y={posterLayout.contentArea.y}
        width={posterLayout.contentArea.width}
        height={posterLayout.contentArea.height}
        className="border"
      />

      <text x={posterLayout.title.x} y={posterLayout.title.y} className="title">
        {svgTitleText}
      </text>
      <line
        x1={posterLayout.title.underline.x1}
        y1={posterLayout.title.underline.y1}
        x2={posterLayout.title.underline.x2}
        y2={posterLayout.title.underline.y2}
        stroke={svgStylesConfig.colors.darkGrey}
        strokeWidth={posterLayout.title.underline.strokeWidth}
      />

      {doSectionElements}
      {delaySectionElements}
      {awaitingSectionElements}
      {doneSectionElements}
    </svg>
  );
};

export default PrintableSvgPoster;
