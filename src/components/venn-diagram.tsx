'use client';

import { useMemo } from 'react';
import type { VennData } from '@/lib/types';

interface VennDiagramProps {
  data: VennData;
}

export function VennDiagram({ data }: VennDiagramProps) {
  const { circles, intersectionLabels } = useMemo(() => {
    const count = data.libraries.length;
    const width = 400;
    const height = 300;
    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate circle positions based on count
    const circles: {
      cx: number;
      cy: number;
      r: number;
      color: string;
      name: string;
      totalItems: number;
    }[] = [];

    const maxItems = Math.max(...data.libraries.map(l => l.totalItems));
    const baseRadius = count === 2 ? 90 : 70;

    if (count === 2) {
      // Two circles side by side with overlap
      const overlap = 0.4;
      const separation = baseRadius * (2 - overlap);
      
      circles.push({
        cx: centerX - separation / 2,
        cy: centerY,
        r: baseRadius,
        color: data.libraries[0].color,
        name: data.libraries[0].name,
        totalItems: data.libraries[0].totalItems,
      });
      circles.push({
        cx: centerX + separation / 2,
        cy: centerY,
        r: baseRadius,
        color: data.libraries[1].color,
        name: data.libraries[1].name,
        totalItems: data.libraries[1].totalItems,
      });
    } else if (count === 3) {
      // Three circles in a triangle formation
      const angleOffset = -Math.PI / 2;
      const distance = baseRadius * 0.8;
      
      for (let i = 0; i < 3; i++) {
        const angle = angleOffset + (i * 2 * Math.PI) / 3;
        const scale = data.libraries[i].totalItems / maxItems;
        const r = baseRadius * (0.7 + 0.3 * scale);
        
        circles.push({
          cx: centerX + Math.cos(angle) * distance,
          cy: centerY + Math.sin(angle) * distance,
          r,
          color: data.libraries[i].color,
          name: data.libraries[i].name,
          totalItems: data.libraries[i].totalItems,
        });
      }
    } else {
      // More than 3: arrange in a circle
      const distance = baseRadius * 0.9;
      const angleOffset = -Math.PI / 2;
      
      for (let i = 0; i < count; i++) {
        const angle = angleOffset + (i * 2 * Math.PI) / count;
        const scale = data.libraries[i].totalItems / maxItems;
        const r = (baseRadius * 0.8) * (0.7 + 0.3 * scale);
        
        circles.push({
          cx: centerX + Math.cos(angle) * distance,
          cy: centerY + Math.sin(angle) * distance,
          r,
          color: data.libraries[i].color,
          name: data.libraries[i].name,
          totalItems: data.libraries[i].totalItems,
        });
      }
    }

    // Calculate intersection label positions with collision avoidance
    const intersectionLabels: { x: number; y: number; text: string }[] = [];
    const usedPositions: { x: number; y: number }[] = [];
    
    const isOverlapping = (x: number, y: number, threshold = 25): boolean => {
      return usedPositions.some(pos => 
        Math.abs(pos.x - x) < threshold && Math.abs(pos.y - y) < threshold
      );
    };

    const findNonOverlappingPosition = (baseX: number, baseY: number, idx1: number, idx2: number): { x: number; y: number } => {
      // Calculate direction perpendicular to the line between circle centers
      const dx = circles[idx2].cx - circles[idx1].cx;
      const dy = circles[idx2].cy - circles[idx1].cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;
      
      // Try offsets perpendicular to the intersection line
      const offsets = [0, 20, -20, 35, -35];
      for (const offset of offsets) {
        const x = baseX + perpX * offset;
        const y = baseY + perpY * offset;
        if (!isOverlapping(x, y)) {
          return { x, y };
        }
      }
      return { x: baseX, y: baseY + 20 }; // Fallback
    };
    
    for (const intersection of data.intersections) {
      if (intersection.sets.length === 2) {
        const idx1 = data.libraries.findIndex(l => l.name === intersection.sets[0]);
        const idx2 = data.libraries.findIndex(l => l.name === intersection.sets[1]);
        
        if (idx1 >= 0 && idx2 >= 0) {
          const baseX = (circles[idx1].cx + circles[idx2].cx) / 2;
          const baseY = (circles[idx1].cy + circles[idx2].cy) / 2;
          const { x, y } = findNonOverlappingPosition(baseX, baseY, idx1, idx2);
          usedPositions.push({ x, y });
          intersectionLabels.push({ x, y, text: intersection.size.toString() });
        }
      }
    }

    return { circles, intersectionLabels };
  }, [data]);

  return (
    <div className="w-full">
      <svg viewBox="0 0 400 300" className="w-full h-auto max-h-[300px]">
        <defs>
          {circles.map((circle, i) => (
            <linearGradient key={i} id={`gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={circle.color} stopOpacity="0.6" />
              <stop offset="100%" stopColor={circle.color} stopOpacity="0.3" />
            </linearGradient>
          ))}
        </defs>
        
        {/* Draw circles */}
        {circles.map((circle, i) => (
          <circle
            key={i}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fill={`url(#gradient-${i})`}
            stroke={circle.color}
            strokeWidth="2"
          />
        ))}

        {/* Draw intersection counts */}
        {intersectionLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-sm font-bold"
          >
            {label.text}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {circles.map((circle, i) => {
          const [serverName, libraryName] = circle.name.split(' - ');
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: circle.color }}
              />
              <span className="max-w-[200px] truncate" title={circle.name}>
                <span className="font-medium">{serverName}</span>
                <span className="text-muted-foreground"> / {libraryName}</span>
              </span>
              <span className="text-muted-foreground">({circle.totalItems})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
