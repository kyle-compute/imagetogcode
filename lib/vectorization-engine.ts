// FILE: lib/vectorization-engine.ts
// Professional Vectorization Engine with Advanced Features

import { CurveFitter, CurveSegment } from './curve-fitting';
import { AdvancedHatcher, HatchingStyle } from './advanced-hatching';
import { LineWeightSimulator, WeightedPath, LineWeightStyle } from './variable-line-weight';
import { PathOptimizer } from './path-optimization';

export interface Point { x: number; y: number; }
export type Path = Point[];
declare const cv: any;

export enum VectorizationMode {
  COLOR_REGIONS = 'Color Regions',
  CENTERLINE = 'Centerline',
  HATCHING = 'Hatching',
}

export interface AdvancedOptions {
  // Curve fitting options
  enableCurveFitting?: boolean;
  curveTolerance?: number;
  enableArcConversion?: boolean;
  
  // Hatching options
  hatchingStyle?: HatchingStyle;
  
  // Line weight options
  enableVariableWeight?: boolean;
  lineWeightStyle?: LineWeightStyle;
  
  // Path optimization options
  enablePathOptimization?: boolean;
  enablePathMerging?: boolean;
  enable2Opt?: boolean;
}

export class VectorizationEngine {

  /**
   * Main router function with advanced processing pipeline
   */
  static process(
    canvas: HTMLCanvasElement, 
    mode: VectorizationMode, 
    options: any,
    advancedOptions: AdvancedOptions = {}
  ): Path[] {
    console.log(`🎯 Starting ${mode} processing with advanced features...`);
    
    // Step 1: Initial vectorization
    let paths: Path[] = [];
    switch (mode) {
      case VectorizationMode.COLOR_REGIONS:
        paths = this.traceColorRegions(canvas, options.numColors);
        break;
      case VectorizationMode.CENTERLINE:
        paths = this.traceCenterlines(canvas, options.threshold, options.proximity);
        break;
      case VectorizationMode.HATCHING:
        paths = this.generateAdvancedHatching(canvas, options, advancedOptions);
        break;
      default:
        return [];
    }

    console.log(`📊 Initial vectorization: ${paths.length} paths`);

    // Step 2: Apply variable line weight (if enabled)
    if (advancedOptions.enableVariableWeight && mode !== VectorizationMode.HATCHING) {
      paths = this.applyVariableLineWeight(paths, canvas, advancedOptions);
    }

    // Step 3: Apply path optimization
    if (advancedOptions.enablePathOptimization) {
      const optimizationResult = PathOptimizer.optimizePaths(paths, {
        enablePathMerging: advancedOptions.enablePathMerging,
        enable2Opt: advancedOptions.enable2Opt,
        mergeThreshold: 5.0,
        maxIterations: 100
      });
      
      paths = optimizationResult.paths;
      console.log(`🔧 Path optimization: ${optimizationResult.improvement.toFixed(1)}% improvement`);
    }

    console.log(`✅ Final result: ${paths.length} optimized paths`);
    return paths;
  }

  /**
   * Process and return curves instead of paths (for advanced G-code generation)
   */
  static processWithCurves(
    canvas: HTMLCanvasElement, 
    mode: VectorizationMode, 
    options: any,
    advancedOptions: AdvancedOptions = {}
  ): CurveSegment[] {
    // Get initial paths
    const paths = this.process(canvas, mode, options, advancedOptions);
    
    if (!advancedOptions.enableCurveFitting) {
      // Convert paths to simple line segments
      return this.pathsToCurveSegments(paths);
    }

    console.log(`🎨 Applying Bézier curve fitting...`);
    
    // Apply curve fitting to each path
    let allCurves: CurveSegment[] = [];
    for (const path of paths) {
      const curves = CurveFitter.fitCurves(path, advancedOptions.curveTolerance || 2.0);
      allCurves.push(...curves);
    }

    // Convert Bézier curves to arcs where possible (if enabled)
    if (advancedOptions.enableArcConversion) {
      console.log(`🔄 Converting to G2/G3 arcs...`);
      allCurves = CurveFitter.convertToArcs(allCurves, 1.0);
    }

    const arcCount = allCurves.filter(c => c.type === 'arc').length;
    const bezierCount = allCurves.filter(c => c.type === 'bezier').length;
    
    console.log(`🎭 Curve fitting complete: ${arcCount} arcs, ${bezierCount} Bézier curves`);
    
    return allCurves;
  }

  // --- STRATEGY A: Color Region Tracing ---
  private static traceColorRegions(canvas: HTMLCanvasElement, numColors: number): Path[] {
    console.log(`Executing COLOR_REGIONS strategy with ${numColors} colors.`);
    
    const src = cv.imread(canvas);
    const paths: Path[] = [];
    
    try {
      // 1. Convert to RGB for better color clustering (Lab not available in OpenCV.js)
      let rgb = new cv.Mat();
      cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
      
      // 2. Prepare data for K-means clustering
      const samples = new cv.Mat(rgb.rows * rgb.cols, 3, cv.CV_32F);
      
      // Fill samples matrix with RGB values
      for (let i = 0; i < rgb.rows * rgb.cols; i++) {
        const pixelIndex = i * 3;
        samples.data32F[pixelIndex] = rgb.data[pixelIndex];     // R
        samples.data32F[pixelIndex + 1] = rgb.data[pixelIndex + 1]; // G
        samples.data32F[pixelIndex + 2] = rgb.data[pixelIndex + 2]; // B
      }
      
      // 3. Apply K-means clustering
      let labels = new cv.Mat();
      let centers = new cv.Mat();
      const criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS + cv.TERM_CRITERIA_MAX_ITER, 20, 1.0);
      
      cv.kmeans(samples, numColors, labels, criteria, 10, cv.KMEANS_RANDOM_CENTERS, centers);
      
      // 4. Create quantized image
      let quantized = new cv.Mat(rgb.rows, rgb.cols, cv.CV_8UC3);
      for (let i = 0; i < rgb.rows * rgb.cols; i++) {
        const label = labels.data32S[i];
        const centerIndex = label * 3;
        const pixelIndex = i * 3;
        quantized.data[pixelIndex] = centers.data32F[centerIndex];
        quantized.data[pixelIndex + 1] = centers.data32F[centerIndex + 1];
        quantized.data[pixelIndex + 2] = centers.data32F[centerIndex + 2];
      }
      
      // 5. For each color, create binary mask and find contours
      for (let colorIndex = 0; colorIndex < numColors; colorIndex++) {
        let mask = new cv.Mat();
        
        // Create mask for this color cluster
        mask = cv.Mat.zeros(rgb.rows, rgb.cols, cv.CV_8UC1);
        for (let i = 0; i < labels.total(); i++) {
          if (labels.data32S[i] === colorIndex) {
            const y = Math.floor(i / rgb.cols);
            const x = i % rgb.cols;
            mask.ucharPtr(y, x)[0] = 255;
          }
        }
        
        // Find contours for this color region
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // Convert contours to paths
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          if (contour.total() > 10) { // Filter small contours
            const path: Point[] = [];
            
            // Extract points from contour
            for (let j = 0; j < contour.total(); j++) {
              const point = contour.data32S;
              path.push({ x: point[j * 2], y: point[j * 2 + 1] });
            }
            
            // Apply Douglas-Peucker simplification
            const simplified = this.douglasPeucker(path, 2.0);
            if (simplified.length >= 3) {
              paths.push(simplified);
            }
          }
        }
        
        mask.delete();
        contours.delete();
        hierarchy.delete();
      }
      
      // Cleanup
      rgb.delete();
      samples.delete();
      labels.delete();
      centers.delete();
      quantized.delete();
      
    } catch (error) {
      console.error('Color region tracing error:', error);
      // Fallback to simple thresholding
      try {
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        
        let binary = new cv.Mat();
        cv.threshold(gray, binary, 128, 255, cv.THRESH_BINARY);
        
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          if (contour.total() > 10) {
            const path: Point[] = [];
            for (let j = 0; j < contour.total(); j++) {
              const point = contour.data32S;
              path.push({ x: point[j * 2], y: point[j * 2 + 1] });
            }
            
            const simplified = this.douglasPeucker(path, 2.0);
            if (simplified.length >= 3) {
              paths.push(simplified);
            }
          }
        }
        
        gray.delete();
        binary.delete();
        contours.delete();
        hierarchy.delete();
        
      } catch (fallbackError) {
        console.error('Fallback processing also failed:', fallbackError);
      }
    } finally {
      src.delete();
    }
    
    return paths;
  }

  // --- STRATEGY B: Centerline Tracing ---
  private static traceCenterlines(canvas: HTMLCanvasElement, threshold: number, proximity: number): Path[] {
    console.log(`Executing CENTERLINE strategy with threshold ${threshold} and proximity ${proximity}.`);
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Extract horizontal segments row by row
    interface Segment {
      y: number;
      x1: number;
      x2: number;
      used: boolean;
      midX: number;
    }

    const segmentsByRow: Segment[][] = Array.from({ length: height }, () => []);
    
    for (let y = 0; y < height; y++) {
      let inSegment = false;
      let x1 = 0;
      
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const isBlack = gray < threshold;

        if (isBlack && !inSegment) {
          inSegment = true;
          x1 = x;
        } else if (!isBlack && inSegment) {
          inSegment = false;
          const x2 = x - 1;
          segmentsByRow[y].push({ y, x1, x2, used: false, midX: (x1 + x2) / 2 });
        }
      }
      
      if (inSegment) {
        const x2 = width - 1;
        segmentsByRow[y].push({ y, x1, x2, used: false, midX: (x1 + x2) / 2 });
      }
    }

    // Stitch segments into paths using bidirectional tracing
    const allPaths: Segment[][] = [];
    
    for (let y = 0; y < height; y++) {
      for (const segment of segmentsByRow[y]) {
        if (segment.used) continue;

        let currentPath = [segment];
        segment.used = true;
        let currentSegment = segment;
        
        // Trace upwards
        for (let prevY = y - 1; prevY >= 0; prevY--) {
          const prevSegment = this.findClosestUnusedSegment(currentSegment, segmentsByRow[prevY], proximity);
          if (prevSegment) {
            currentPath.unshift(prevSegment);
            prevSegment.used = true;
            currentSegment = prevSegment;
          } else {
            break;
          }
        }
        
        // Reset and trace downwards
        currentSegment = segment;
        for (let nextY = y + 1; nextY < height; nextY++) {
          const nextSegment = this.findClosestUnusedSegment(currentSegment, segmentsByRow[nextY], proximity);
          if (nextSegment) {
            currentPath.push(nextSegment);
            nextSegment.used = true;
            currentSegment = nextSegment;
          } else {
            break;
          }
        }
        
        if (currentPath.length >= 3) {
          allPaths.push(currentPath);
        }
      }
    }

    // Convert to point paths
    return allPaths.map(path => 
      path.map(seg => ({ x: seg.midX, y: seg.y }))
    );
  }

  // --- STRATEGY C: Advanced Hatching ---
  private static generateAdvancedHatching(
    canvas: HTMLCanvasElement, 
    options: any,
    advancedOptions: AdvancedOptions
  ): Path[] {
    const { numColors, hatchSpacing, hatchAngle } = options;
    const hatchingStyle = advancedOptions.hatchingStyle || HatchingStyle.PARALLEL;
    
    console.log(`Executing ADVANCED HATCHING strategy: ${hatchingStyle}`);
    
    const src = cv.imread(canvas);
    const paths: Path[] = [];
    
    try {
      // Convert to grayscale and quantize intensity levels
      let gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      const step = 255 / numColors;
      let quantized = new cv.Mat();
      gray.copyTo(quantized);
      
      for (let i = 0; i < quantized.rows * quantized.cols; i++) {
        const intensity = quantized.data[i];
        const level = Math.floor(intensity / step);
        quantized.data[i] = level * step;
      }
      
      // Generate hatching for each intensity level
      for (let level = 0; level < numColors - 1; level++) {
        const targetIntensity = level * step;
        const intensity = 1 - (level / (numColors - 1)); // Normalized intensity
        
        // Create mask for this intensity level
        let mask = new cv.Mat();
        cv.threshold(quantized, mask, targetIntensity + step/2, 255, cv.THRESH_BINARY_INV);
        
        // Generate advanced hatching
        const hatchPaths = AdvancedHatcher.generateHatching(
          mask,
          intensity,
          hatchingStyle,
          hatchSpacing,
          hatchAngle,
          canvas.width,
          canvas.height
        );
        
        paths.push(...hatchPaths);
        mask.delete();
      }
      
      gray.delete();
      quantized.delete();
      
    } catch (error) {
      console.error('Advanced hatching error:', error);
      // Fallback to simple hatching
      return this.generateSimpleHatching(canvas, numColors, hatchSpacing, hatchAngle);
    } finally {
      src.delete();
    }
    
    return paths;
  }

  // Fallback simple hatching method
  private static generateSimpleHatching(
    canvas: HTMLCanvasElement, 
    numColors: number, 
    spacing: number, 
    angle: number
  ): Path[] {
    const src = cv.imread(canvas);
    const paths: Path[] = [];
    
    try {
      let gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      const step = 255 / numColors;
      let quantized = new cv.Mat();
      gray.copyTo(quantized);
      
      for (let i = 0; i < quantized.rows * quantized.cols; i++) {
        const intensity = quantized.data[i];
        const level = Math.floor(intensity / step);
        quantized.data[i] = level * step;
      }
      
      for (let level = 0; level < numColors - 1; level++) {
        const targetIntensity = level * step;
        let mask = new cv.Mat();
        cv.threshold(quantized, mask, targetIntensity + step/2, 255, cv.THRESH_BINARY_INV);
        
        const hatchPaths = this.generateHatchLines(canvas.width, canvas.height, spacing * (level + 1), angle, mask);
        paths.push(...hatchPaths);
        mask.delete();
      }
      
      gray.delete();
      quantized.delete();
      
    } catch (error) {
      console.error('Simple hatching fallback error:', error);
    } finally {
      src.delete();
    }
    
    return paths;
  }

  // Helper function for hatching
  private static generateHatchLines(width: number, height: number, spacing: number, angle: number, mask: any): Path[] {
    const paths: Path[] = [];
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    
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
          const pixelIndex = y * width + x;
          const isInMask = mask.data[pixelIndex] > 0;
          
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

  // --- UTILITY FUNCTIONS ---
  
  private static findClosestUnusedSegment(from: any, candidates: any[], proximity: number): any {
    let bestMatch = null;
    let minDistance = Infinity;

    for (const to of candidates) {
      if (to.used) continue;
      
      const horizontalDistance = Math.max(0, Math.max(from.x1, to.x1) - Math.min(from.x2, to.x2));
      
      if (horizontalDistance <= proximity * 2) {
        const midPointDistance = Math.abs(from.midX - to.midX);
        const totalDistance = midPointDistance + horizontalDistance * 0.5;
        
        if (totalDistance < minDistance) {
          minDistance = totalDistance;
          bestMatch = to;
        }
      }
    }
    
    return bestMatch;
  }

  private static douglasPeucker(points: Point[], epsilon: number): Point[] {
    if (points.length <= 2) return points;

    let maxDistance = 0;
    let maxIndex = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const distance = this.perpendicularDistance(points[i], points[0], points[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > epsilon) {
      const left = this.douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
      const right = this.douglasPeucker(points.slice(maxIndex), epsilon);
      
      return [...left.slice(0, -1), ...right];
    } else {
      return [points[0], points[end]];
    }
  }

  private static perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const A = lineEnd.y - lineStart.y;
    const B = lineStart.x - lineEnd.x;
    const C = lineEnd.x * lineStart.y - lineStart.x * lineEnd.y;
    
    return Math.abs(A * point.x + B * point.y + C) / Math.sqrt(A * A + B * B);
  }

  // --- HELPER METHODS ---

  /**
   * Apply variable line weight to paths
   */
  private static applyVariableLineWeight(
    paths: Path[], 
    canvas: HTMLCanvasElement, 
    advancedOptions: AdvancedOptions
  ): Path[] {
    console.log(`🎨 Applying variable line weight...`);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return paths;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const weightedPaths: WeightedPath[] = paths.map(path => ({
      centerline: path,
      weight: LineWeightSimulator.analyzeLineWeight(path, imageData, 'detail'),
      style: advancedOptions.lineWeightStyle || LineWeightStyle.PARALLEL
    }));
    
    const simulatedPaths = LineWeightSimulator.simulateVariableWeight(weightedPaths);
    console.log(`📏 Line weight simulation: ${paths.length} → ${simulatedPaths.length} paths`);
    
    return simulatedPaths;
  }

  /**
   * Convert simple paths to curve segments (for compatibility)
   */
  private static pathsToCurveSegments(paths: Path[]): CurveSegment[] {
    const curves: CurveSegment[] = [];
    
    for (const path of paths) {
      if (path.length < 2) continue;
      
      for (let i = 0; i < path.length - 1; i++) {
        // Create simple linear "bezier" curves
        const start = path[i];
        const end = path[i + 1];
        const control1 = { 
          x: start.x + (end.x - start.x) * 0.33, 
          y: start.y + (end.y - start.y) * 0.33 
        };
        const control2 = { 
          x: start.x + (end.x - start.x) * 0.67, 
          y: start.y + (end.y - start.y) * 0.67 
        };
        
        curves.push({
          start,
          control1,
          control2,
          end,
          type: 'bezier'
        });
      }
    }
    
    return curves;
  }

  // --- PATH SORTING ---
  static sortPathsForPrinting(paths: Path[]): Path[] {
    // Use the advanced path optimization for better results
    const optimizationResult = PathOptimizer.optimizePaths(paths, {
      enablePathMerging: true,
      enable2Opt: true,
      mergeThreshold: 5.0,
      maxIterations: 50
    });
    
    console.log(`🔄 Path sorting optimization: ${optimizationResult.improvement.toFixed(1)}% improvement`);
    return optimizationResult.paths;
  }
}