'use client';

import React from 'react';
import classes from './PosterCanvas.module.css';

interface PosterCanvasProps {
  zoomMode: 'fit' | 'actual';
  svgMarkup?: string;
  children?: React.ReactNode;
  tiledSvgs?: string[];
}

export const PosterCanvas: React.FC<PosterCanvasProps> = ({
  zoomMode,
  svgMarkup,
  children,
  tiledSvgs,
}) => {
  const containerClass = `${classes.canvasContainer} ${
    zoomMode === 'fit' ? classes.fitScreen : classes.actualScale
  }`;

  return (
    <div className={classes.viewport}>
      {tiledSvgs && tiledSvgs.length > 0 ? (
        <div className={classes.tiledContainer}>
          {tiledSvgs.map((tileSvg, index) => (
            <div
              key={index}
              className={`${containerClass} ${classes.tileSheet}`}
              dangerouslySetInnerHTML={{ __html: tileSvg }}
            />
          ))}
        </div>
      ) : svgMarkup ? (
        <div className={containerClass} dangerouslySetInnerHTML={{ __html: svgMarkup }} />
      ) : (
        <div className={containerClass}>{children}</div>
      )}
    </div>
  );
};
