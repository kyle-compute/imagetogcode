// Variable Line Weight Simulation
// Creates the illusion of thick/thin lines using multiple parallel paths

export interface Point {
  x: number;
  y: number;
}

export type Path = Point[];

export interface WeightedPath {
  centerline: Path;
  weight: number; // 1.0 = normal, >1.0 = thicker, <1.0 = thinner
  style: LineWeightStyle;
}

export enum LineWeightStyle {
  PARALLEL = 'Parallel Lines',    // Multiple parallel strokes
  OUTLINE = 'Outline Fill',       // Draw outline then fill
  SCRIBBLE = 'Scribble Fill',     // Loose scribble pattern
  ZIGZAG = 'Zigzag Fill'         // Tight zigzag pattern
}

export class LineWeightSimulator {
  
  /**
   * Convert weighted paths to multiple drawable paths
   */
  static simulateVariableWeight(weightedPaths: WeightedPath[]): Path[] {
    const outputPaths: Path[] = [];
    
    for (const weightedPath of weightedPaths) {
      const simulatedPaths = this.simulateWeight(
        weightedPath.centerline,
        weightedPath.weight,
        weightedPath.style
      );
      outputPaths.push(...simulatedPaths);
    }
    
    return outputPaths;
  }
  
  /**
   * Simulate line weight for a single path
   */
  private static simulateWeight(centerline: Path, weight: number, style: LineWeightStyle): Path[] {
    if (centerline.length < 2) return [centerline];
    if (weight <= 1.0) return [centerline]; // No simulation needed for thin lines
    
    switch (style) {
      case LineWeightStyle.PARALLEL:
        return this.createParallelLines(centerline, weight);
      
      case LineWeightStyle.OUTLINE:
        return this.createOutlineFill(centerline, weight);
      
      case LineWeightStyle.SCRIBBLE:
        return this.createScribbleFill(centerline, weight);
      
      case LineWeightStyle.ZIGZAG:
        return this.createZigzagFill(centerline, weight);
      
      default:
        return this.createParallelLines(centerline, weight);
    }
  }
  
  /**
   * Create multiple parallel lines to simulate thickness
   */
  private static createParallelLines(centerline: Path, weight: number): Path[] {
    const paths: Path[] = [];
    const thickness = (weight - 1) * 2; // Convert weight to actual thickness
    const numLines = Math.max(1, Math.ceil(weight * 2)); // More lines = thicker appearance
    
    for (let i = 0; i < numLines; i++) {
      const offset = (i - (numLines - 1) / 2) * (thickness / Math.max(1, numLines - 1));
      const offsetPath = this.offsetPath(centerline, offset);
      if (offsetPath.length > 1) {
        paths.push(offsetPath);
      }
    }
    
    return paths;
  }
  
  /**
   * Create outline and fill pattern
   */
  private static createOutlineFill(centerline: Path, weight: number): Path[] {
    const paths: Path[] = [];
    const thickness = (weight - 1) * 2;
    
    // Create outline paths
    const topOutline = this.offsetPath(centerline, thickness / 2);
    const bottomOutline = this.offsetPath(centerline, -thickness / 2);
    
    if (topOutline.length > 1) paths.push(topOutline);
    if (bottomOutline.length > 1) paths.push(bottomOutline);
    
    // Create fill lines between outlines
    const fillSpacing = Math.max(0.5, thickness / 8);
    const numFillLines = Math.floor(thickness / fillSpacing) - 1;
    
    for (let i = 1; i <= numFillLines; i++) {
      const offset = -thickness / 2 + (i * fillSpacing);
      const fillPath = this.offsetPath(centerline, offset);
      if (fillPath.length > 1) {
        // Make fill lines slightly shorter for artistic effect
        const shortened = this.shortenPath(fillPath, 0.1);
        paths.push(shortened);
      }
    }
    
    return paths;
  }
  
  /**
   * Create loose scribble fill pattern
   */
  private static createScribbleFill(centerline: Path, weight: number): Path[] {
    const paths: Path[] = [];
    const thickness = (weight - 1) * 2;
    
    // Add the main centerline
    paths.push(centerline);
    
    // Create scribble patterns around the centerline
    const scribbleIntensity = Math.min(thickness, 4); // Limit intensity
    const numScribbles = Math.ceil(scribbleIntensity * 3);
    
    for (let i = 0; i < numScribbles; i++) {
      const scribblePath = this.createScribbleAroundPath(centerline, thickness, i);
      if (scribblePath.length > 1) {
        paths.push(scribblePath);
      }
    }
    
    return paths;
  }
  
  /**
   * Create tight zigzag fill pattern
   */
  private static createZigzagFill(centerline: Path, weight: number): Path[] {
    const paths: Path[] = [];
    const thickness = (weight - 1) * 2;
    
    // Create zigzag pattern that fills the thick line area
    const zigzagPath = this.createZigzagPattern(centerline, thickness);
    if (zigzagPath.length > 1) {
      paths.push(zigzagPath);
    }
    
    // Add outline for definition
    const topOutline = this.offsetPath(centerline, thickness / 2);
    const bottomOutline = this.offsetPath(centerline, -thickness / 2);
    
    if (topOutline.length > 1) paths.push(topOutline);
    if (bottomOutline.length > 1) paths.push(bottomOutline);
    
    return paths;
  }
  
  /**
   * Offset a path by a perpendicular distance
   */
  private static offsetPath(path: Path, distance: number): Path {
    if (path.length < 2) return path;
    if (Math.abs(distance) < 0.1) return path; // No offset needed
    
    const offsetPath: Point[] = [];
    
    for (let i = 0; i < path.length; i++) {
      const current = path[i];
      let normal: Point;
      
      if (i === 0) {
        // First point - use direction to next point
        const next = path[1];
        normal = this.calculateNormal(current, next);
      } else if (i === path.length - 1) {
        // Last point - use direction from previous point
        const prev = path[i - 1];
        normal = this.calculateNormal(prev, current);
      } else {
        // Middle point - average of two normals
        const prev = path[i - 1];
        const next = path[i + 1];
        const normal1 = this.calculateNormal(prev, current);
        const normal2 = this.calculateNormal(current, next);
        normal = {
          x: (normal1.x + normal2.x) / 2,
          y: (normal1.y + normal2.y) / 2
        };
        
        // Normalize
        const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
        if (length > 0) {
          normal.x /= length;
          normal.y /= length;
        }
      }
      
      offsetPath.push({
        x: current.x + normal.x * distance,
        y: current.y + normal.y * distance
      });
    }
    
    return offsetPath;
  }
  
  /**
   * Calculate perpendicular normal vector
   */
  private static calculateNormal(p1: Point, p2: Point): Point {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return { x: 0, y: 1 };
    
    // Perpendicular vector (rotated 90 degrees)
    return {
      x: -dy / length,
      y: dx / length
    };
  }
  
  /**
   * Shorten a path from both ends
   */
  private static shortenPath(path: Path, factor: number): Path {
    if (path.length < 3) return path;
    
    const removeCount = Math.floor(path.length * factor / 2);
    const startIndex = Math.max(0, removeCount);
    const endIndex = Math.min(path.length, path.length - removeCount);
    
    return path.slice(startIndex, endIndex);
  }
  
  /**
   * Create scribble pattern around a path
   */
  private static createScribbleAroundPath(centerline: Path, thickness: number, seed: number): Path {
    const scribble: Point[] = [];
    const wobbleAmount = thickness / 4;
    
    // Use seed for deterministic randomness
    let random = this.seededRandom(seed);
    
    for (let i = 0; i < centerline.length; i++) {
      const point = centerline[i];
      
      // Add some random wobble
      const wobbleX = (random() - 0.5) * wobbleAmount;
      const wobbleY = (random() - 0.5) * wobbleAmount;
      
      scribble.push({
        x: point.x + wobbleX,
        y: point.y + wobbleY
      });
      
      // Occasionally add extra random points for more organic feel
      if (random() < 0.3 && i < centerline.length - 1) {
        const nextPoint = centerline[i + 1];
        const midX = (point.x + nextPoint.x) / 2 + (random() - 0.5) * wobbleAmount;
        const midY = (point.y + nextPoint.y) / 2 + (random() - 0.5) * wobbleAmount;
        scribble.push({ x: midX, y: midY });
      }
    }
    
    return scribble;
  }
  
  /**
   * Create zigzag pattern along a path
   */
  private static createZigzagPattern(centerline: Path, thickness: number): Path {
    const zigzag: Point[] = [];
    const amplitude = thickness / 2;
    const frequency = Math.max(2, thickness); // Zigzag frequency
    
    for (let i = 0; i < centerline.length - 1; i++) {
      const current = centerline[i];
      const next = centerline[i + 1];
      const normal = this.calculateNormal(current, next);
      
      // Calculate how many zigzag segments fit in this line segment
      const segmentLength = Math.sqrt(
        (next.x - current.x) ** 2 + (next.y - current.y) ** 2
      );
      const numZigs = Math.max(1, Math.floor(segmentLength / frequency));
      
      for (let j = 0; j <= numZigs; j++) {
        const t = j / numZigs;
        const basePoint = {
          x: current.x + (next.x - current.x) * t,
          y: current.y + (next.y - current.y) * t
        };
        
        // Alternate sides for zigzag
        const side = (j % 2 === 0) ? 1 : -1;
        const zigzagPoint = {
          x: basePoint.x + normal.x * amplitude * side,
          y: basePoint.y + normal.y * amplitude * side
        };
        
        zigzag.push(zigzagPoint);
      }
    }
    
    return zigzag;
  }
  
  /**
   * Analyze path to determine appropriate line weight
   * Based on contrast and context
   */
  static analyzeLineWeight(
    path: Path,
    imageData: ImageData,
    context: 'outline' | 'detail' | 'fill' = 'detail'
  ): number {
    if (path.length < 2) return 1.0;
    
    // Sample points along the path to analyze contrast
    const samplePoints = Math.min(10, path.length);
    let totalContrast = 0;
    let validSamples = 0;
    
    for (let i = 0; i < samplePoints; i++) {
      const index = Math.floor((i / (samplePoints - 1)) * (path.length - 1));
      const point = path[index];
      
      const contrast = this.measureLocalContrast(point, imageData);
      if (contrast >= 0) {
        totalContrast += contrast;
        validSamples++;
      }
    }
    
    if (validSamples === 0) return 1.0;
    
    const avgContrast = totalContrast / validSamples;
    
    // Determine weight based on context and contrast
    switch (context) {
      case 'outline':
        // Outlines should be thicker, especially high-contrast ones
        return 1.0 + avgContrast * 2.0;
      
      case 'detail':
        // Detail lines vary based on contrast
        return 1.0 + avgContrast * 1.0;
      
      case 'fill':
        // Fill lines should be thinner
        return Math.max(0.5, 1.0 - avgContrast * 0.5);
      
      default:
        return 1.0 + avgContrast;
    }
  }
  
  /**
   * Measure local contrast around a point
   */
  private static measureLocalContrast(point: Point, imageData: ImageData): number {
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const { width, height, data } = imageData;
    
    if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) return -1;
    
    // Sample 3x3 neighborhood
    let minBrightness = 255;
    let maxBrightness = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const idx = ((y + dy) * width + (x + dx)) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        minBrightness = Math.min(minBrightness, brightness);
        maxBrightness = Math.max(maxBrightness, brightness);
      }
    }
    
    // Return normalized contrast (0-1)
    return (maxBrightness - minBrightness) / 255;
  }
  
  /**
   * Simple seeded random number generator
   */
  private static seededRandom(seed: number): () => number {
    let state = seed;
    return function() {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}