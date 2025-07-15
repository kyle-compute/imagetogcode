// Advanced Hatching and Shading Techniques
// Professional artistic rendering methods for tone and texture

export interface Point {
  x: number;
  y: number;
}

export type Path = Point[];

export enum HatchingStyle {
  PARALLEL = 'Parallel Lines',
  CONTOUR = 'Contour Following', 
  CROSS = 'Cross Hatching',
  STIPPLING = 'Stippling/Dots'
}

export class AdvancedHatcher {
  
  /**
   * Generate sophisticated hatching for a masked region
   */
  static generateHatching(
    mask: any, // OpenCV Mat
    intensity: number, // 0-1, where 0 is lightest, 1 is darkest
    style: HatchingStyle,
    baseSpacing: number,
    angle: number,
    width: number,
    height: number
  ): Path[] {
    
    switch (style) {
      case HatchingStyle.CONTOUR:
        return this.generateContourHatching(mask, intensity, baseSpacing, width, height);
      
      case HatchingStyle.CROSS:
        return this.generateCrossHatching(mask, intensity, baseSpacing, angle, width, height);
      
      case HatchingStyle.STIPPLING:
        return this.generateStippling(mask, intensity, baseSpacing, width, height);
      
      default:
        return this.generateParallelHatching(mask, intensity, baseSpacing, angle, width, height);
    }
  }
  
  /**
   * Contour hatching - lines follow the shape boundaries
   * Creates natural volume and form
   */
  private static generateContourHatching(
    mask: any,
    intensity: number,
    baseSpacing: number,
    width: number,
    height: number
  ): Path[] {
    const paths: Path[] = [];
    
    try {
      // Find contours of the mask
      const contours = new (globalThis as any).cv.MatVector();
      const hierarchy = new (globalThis as any).cv.Mat();
      (globalThis as any).cv.findContours(mask, contours, hierarchy, (globalThis as any).cv.RETR_LIST, (globalThis as any).cv.CHAIN_APPROX_SIMPLE);
      
      if (contours.size() === 0) {
        contours.delete();
        hierarchy.delete();
        return paths;
      }
      
      // Calculate dynamic spacing based on intensity
      const spacing = baseSpacing / (0.3 + intensity * 0.7); // Tighter spacing for darker areas
      const numLayers = Math.ceil(intensity * 8); // More layers for darker tones
      
      // Generate multiple concentric contour layers
      for (let layer = 0; layer < numLayers; layer++) {
        const offset = -layer * spacing; // Negative offset moves inward
        
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          const offsetContour = this.offsetContour(contour, offset);
          
          if (offsetContour && offsetContour.length > 3) {
            // Smooth the contour to remove sharp corners
            const smoothed = this.smoothContour(offsetContour);
            if (smoothed.length > 2) {
              paths.push(smoothed);
            }
          }
        }
      }
      
      contours.delete();
      hierarchy.delete();
      
    } catch (error) {
      console.error('Contour hatching error:', error);
    }
    
    return paths;
  }
  
  /**
   * Cross hatching - multiple layers at different angles
   * Classic artistic technique for building up darkness
   */
  private static generateCrossHatching(
    mask: any,
    intensity: number,
    baseSpacing: number,
    primaryAngle: number,
    width: number,
    height: number
  ): Path[] {
    const paths: Path[] = [];
    
    // Calculate number of hatch layers based on intensity
    const maxLayers = 4;
    const numLayers = Math.ceil(intensity * maxLayers);
    
    // Define angles for each layer
    const angles = [
      primaryAngle,
      primaryAngle + 90,
      primaryAngle + 45,
      primaryAngle + 135
    ];
    
    // Generate each layer with progressively tighter spacing
    for (let layer = 0; layer < numLayers; layer++) {
      const layerAngle = angles[layer % angles.length];
      const layerSpacing = baseSpacing * (1 + layer * 0.3); // Vary spacing slightly
      const layerPaths = this.generateParallelHatching(mask, 1.0, layerSpacing, layerAngle, width, height);
      
      // For additional layers, make lines slightly shorter and more varied
      if (layer > 0) {
        const modifiedPaths = layerPaths.map(path => this.varyLineLength(path, 0.8 + Math.random() * 0.4));
        paths.push(...modifiedPaths);
      } else {
        paths.push(...layerPaths);
      }
    }
    
    return paths;
  }
  
  /**
   * Stippling - density-based dot patterns
   * Creates subtle tonal gradations
   */
  private static generateStippling(
    mask: any,
    intensity: number,
    baseSpacing: number,
    width: number,
    height: number
  ): Path[] {
    const paths: Path[] = [];
    
    // Calculate dot density based on intensity
    const dotDensity = intensity * 0.3; // Max 30% coverage
    const minSpacing = baseSpacing * 0.5;
    const maxSpacing = baseSpacing * 2;
    
    // Use Poisson disk sampling for natural dot distribution
    const dots = this.poissonDiskSampling(width, height, minSpacing, maxSpacing, dotDensity);
    
    // Filter dots to only those inside the mask
    for (const dot of dots) {
      if (this.isPointInMask(dot, mask)) {
        // Create a small dot (very short path)
        const dotSize = 0.5 + Math.random() * 1; // Vary dot size slightly
        paths.push([
          dot,
          { x: dot.x + dotSize, y: dot.y }
        ]);
      }
    }
    
    return paths;
  }
  
  /**
   * Standard parallel line hatching with clipping
   */
  private static generateParallelHatching(
    mask: any,
    intensity: number,
    baseSpacing: number,
    angle: number,
    width: number,
    height: number
  ): Path[] {
    const paths: Path[] = [];
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    
    // Adjust spacing based on intensity
    const spacing = baseSpacing / Math.max(0.3, intensity);
    
    // Generate parallel lines across the canvas
    const diagonal = Math.sqrt(width * width + height * height);
    
    for (let offset = -diagonal; offset < diagonal; offset += spacing) {
      const path: Point[] = [];
      
      // Calculate line endpoints
      const startX = -diagonal * cos + offset * (-sin);
      const startY = -diagonal * sin + offset * cos;
      const endX = diagonal * cos + offset * (-sin);
      const endY = diagonal * sin + offset * cos;
      
      // Sample points along the line and check against mask
      const steps = Math.floor(diagonal * 2);
      let inRegion = false;
      
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const x = Math.round(startX + (endX - startX) * t);
        const y = Math.round(startY + (endY - startY) * t);
        
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const isInMask = this.isPointInMask({ x, y }, mask);
          
          if (isInMask && !inRegion) {
            // Start new line segment
            path.push({ x, y });
            inRegion = true;
          } else if (!isInMask && inRegion) {
            // End current line segment
            if (path.length > 1) {
              paths.push([...path]);
            }
            path.length = 0;
            inRegion = false;
          } else if (isInMask && inRegion) {
            // Continue current segment
            path.push({ x, y });
          }
        }
      }
      
      // Add final segment if needed
      if (path.length > 1) {
        paths.push(path);
      }
    }
    
    return paths;
  }
  
  /**
   * Offset a contour inward/outward by a specified distance
   */
  private static offsetContour(contour: any, offset: number): Point[] | null {
    if (!contour || contour.total() < 3) return null;
    
    const points: Point[] = [];
    
    // Extract points from OpenCV contour
    for (let i = 0; i < contour.total(); i++) {
      const point = contour.data32S;
      points.push({ x: point[i * 2], y: point[i * 2 + 1] });
    }
    
    if (points.length < 3) return null;
    
    // Simple offset algorithm - move each point along its normal
    const offsetPoints: Point[] = [];
    
    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      
      // Calculate normal vector
      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
      const v2 = { x: next.x - curr.x, y: next.y - curr.y };
      
      // Average direction
      const normal = { x: -(v1.y + v2.y), y: v1.x + v2.x };
      const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
      
      if (length > 0) {
        normal.x /= length;
        normal.y /= length;
        
        offsetPoints.push({
          x: curr.x + normal.x * offset,
          y: curr.y + normal.y * offset
        });
      } else {
        offsetPoints.push(curr);
      }
    }
    
    return offsetPoints;
  }
  
  /**
   * Smooth a contour using a simple moving average
   */
  private static smoothContour(points: Point[], iterations: number = 2): Point[] {
    let smoothed = [...points];
    
    for (let iter = 0; iter < iterations; iter++) {
      const newPoints: Point[] = [];
      
      for (let i = 0; i < smoothed.length; i++) {
        const prev = smoothed[(i - 1 + smoothed.length) % smoothed.length];
        const curr = smoothed[i];
        const next = smoothed[(i + 1) % smoothed.length];
        
        newPoints.push({
          x: (prev.x + 2 * curr.x + next.x) / 4,
          y: (prev.y + 2 * curr.y + next.y) / 4
        });
      }
      
      smoothed = newPoints;
    }
    
    return smoothed;
  }
  
  /**
   * Vary the length of a line for artistic effect
   */
  private static varyLineLength(path: Point[], factor: number): Point[] {
    if (path.length < 2) return path;
    
    const newLength = Math.floor(path.length * factor);
    if (newLength < 2) return [path[0], path[1]];
    
    const startIndex = Math.floor((path.length - newLength) / 2);
    return path.slice(startIndex, startIndex + newLength);
  }
  
  /**
   * Poisson disk sampling for natural dot distribution
   */
  private static poissonDiskSampling(
    width: number, 
    height: number, 
    minDist: number, 
    maxDist: number, 
    density: number
  ): Point[] {
    const points: Point[] = [];
    const cellSize = minDist / Math.sqrt(2);
    const gridWidth = Math.ceil(width / cellSize);
    const gridHeight = Math.ceil(height / cellSize);
    const grid: (Point | null)[][] = Array(gridWidth).fill(null).map(() => Array(gridHeight).fill(null));
    
    const active: Point[] = [];
    const k = 30; // Maximum attempts per point
    
    // Start with a random point
    const first = { x: Math.random() * width, y: Math.random() * height };
    const firstGridX = Math.floor(first.x / cellSize);
    const firstGridY = Math.floor(first.y / cellSize);
    grid[firstGridX][firstGridY] = first;
    points.push(first);
    active.push(first);
    
    while (active.length > 0 && points.length < width * height * density / (minDist * minDist)) {
      const randomIndex = Math.floor(Math.random() * active.length);
      const current = active[randomIndex];
      let found = false;
      
      for (let i = 0; i < k; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = minDist + Math.random() * (maxDist - minDist);
        const candidate = {
          x: current.x + Math.cos(angle) * distance,
          y: current.y + Math.sin(angle) * distance
        };
        
        if (candidate.x >= 0 && candidate.x < width && candidate.y >= 0 && candidate.y < height) {
          const gridX = Math.floor(candidate.x / cellSize);
          const gridY = Math.floor(candidate.y / cellSize);
          
          let valid = true;
          
          // Check neighboring grid cells
          for (let dx = -2; dx <= 2 && valid; dx++) {
            for (let dy = -2; dy <= 2 && valid; dy++) {
              const nx = gridX + dx;
              const ny = gridY + dy;
              
              if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight && grid[nx][ny]) {
                const neighbor = grid[nx][ny]!;
                const dist = Math.sqrt(
                  (candidate.x - neighbor.x) ** 2 + (candidate.y - neighbor.y) ** 2
                );
                if (dist < minDist) {
                  valid = false;
                }
              }
            }
          }
          
          if (valid) {
            grid[gridX][gridY] = candidate;
            points.push(candidate);
            active.push(candidate);
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        active.splice(randomIndex, 1);
      }
    }
    
    return points;
  }
  
  /**
   * Check if a point is inside the mask
   */
  private static isPointInMask(point: Point, mask: any): boolean {
    try {
      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      
      if (x < 0 || x >= mask.cols || y < 0 || y >= mask.rows) {
        return false;
      }
      
      return mask.ucharPtr(y, x)[0] > 0;
    } catch (error) {
      return false;
    }
  }
}