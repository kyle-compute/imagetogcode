// Advanced Path Optimization
// Professional TSP solving and path merging for minimal travel time

export interface Point {
  x: number;
  y: number;
}

export type Path = Point[];

export interface OptimizationResult {
  paths: Path[];
  totalDistance: number;
  improvement: number; // Percentage improvement over original
}

export class PathOptimizer {
  
  /**
   * Comprehensive path optimization using multiple strategies
   */
  static optimizePaths(paths: Path[], options: {
    enablePathMerging?: boolean;
    enable2Opt?: boolean;
    mergeThreshold?: number;
    maxIterations?: number;
  } = {}): OptimizationResult {
    
    const {
      enablePathMerging = true,
      enable2Opt = true,
      mergeThreshold = 5.0,
      maxIterations = 100
    } = options;
    
    if (paths.length === 0) {
      return { paths: [], totalDistance: 0, improvement: 0 };
    }
    
    const originalDistance = this.calculateTotalTravelDistance(paths);
    let optimizedPaths = [...paths];
    
    // Step 1: Merge nearby paths to eliminate pen-up/pen-down cycles
    if (enablePathMerging) {
      optimizedPaths = this.mergePaths(optimizedPaths, mergeThreshold);
    }
    
    // Step 2: Apply 2-opt optimization for global path ordering
    if (enable2Opt && optimizedPaths.length > 2) {
      optimizedPaths = this.apply2Opt(optimizedPaths, maxIterations);
    }
    
    // Step 3: Fine-tune with greedy improvements
    optimizedPaths = this.greedyImprovement(optimizedPaths);
    
    const finalDistance = this.calculateTotalTravelDistance(optimizedPaths);
    const improvement = originalDistance > 0 ? 
      ((originalDistance - finalDistance) / originalDistance) * 100 : 0;
    
    return {
      paths: optimizedPaths,
      totalDistance: finalDistance,
      improvement
    };
  }
  
  /**
   * Merge paths that are close together to eliminate unnecessary pen movements
   */
  private static mergePaths(paths: Path[], threshold: number): Path[] {
    if (paths.length <= 1) return paths;
    
    const merged: Path[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < paths.length; i++) {
      if (used.has(i)) continue;
      
      let currentPath = [...paths[i]];
      used.add(i);
      
      // Try to merge with other paths
      let foundMerge = true;
      while (foundMerge) {
        foundMerge = false;
        
        for (let j = 0; j < paths.length; j++) {
          if (used.has(j)) continue;
          
          const otherPath = paths[j];
          const mergeResult = this.tryMergePaths(currentPath, otherPath, threshold);
          
          if (mergeResult) {
            currentPath = mergeResult;
            used.add(j);
            foundMerge = true;
            break; // Start over to find more merges
          }
        }
      }
      
      if (currentPath.length > 0) {
        merged.push(currentPath);
      }
    }
    
    return merged;
  }
  
  /**
   * Try to merge two paths if they are close enough
   */
  private static tryMergePaths(path1: Path, path2: Path, threshold: number): Path | null {
    if (path1.length === 0 || path2.length === 0) return null;
    
    const p1Start = path1[0];
    const p1End = path1[path1.length - 1];
    const p2Start = path2[0];
    const p2End = path2[path2.length - 1];
    
    // Check all possible connections
    const connections = [
      { dist: this.distance(p1End, p2Start), merge: () => [...path1, ...path2] },
      { dist: this.distance(p1End, p2End), merge: () => [...path1, ...path2.slice().reverse()] },
      { dist: this.distance(p1Start, p2Start), merge: () => [...path1.slice().reverse(), ...path2] },
      { dist: this.distance(p1Start, p2End), merge: () => [...path1.slice().reverse(), ...path2.slice().reverse()] }
    ];
    
    // Find the best connection within threshold
    const best = connections.reduce((min, conn) => 
      conn.dist < min.dist ? conn : min
    );
    
    if (best.dist <= threshold) {
      return best.merge();
    }
    
    return null;
  }
  
  /**
   * Apply 2-opt optimization to improve path ordering
   * This is a classic TSP optimization technique
   */
  private static apply2Opt(paths: Path[], maxIterations: number): Path[] {
    if (paths.length < 4) return paths; // Need at least 4 paths for 2-opt
    
    let currentOrder = paths.map((_, index) => index);
    let bestDistance = this.calculatePathOrderDistance(paths, currentOrder);
    let improved = true;
    let iteration = 0;
    
    while (improved && iteration < maxIterations) {
      improved = false;
      
      for (let i = 1; i < currentOrder.length - 2; i++) {
        for (let j = i + 1; j < currentOrder.length; j++) {
          if (j - i === 1) continue; // Skip adjacent paths
          
          // Try 2-opt swap
          const newOrder = this.swap2Opt(currentOrder, i, j);
          const newDistance = this.calculatePathOrderDistance(paths, newOrder);
          
          if (newDistance < bestDistance) {
            currentOrder = newOrder;
            bestDistance = newDistance;
            improved = true;
          }
        }
      }
      
      iteration++;
    }
    
    // Reorder paths according to optimized order
    return currentOrder.map(index => paths[index]);
  }
  
  /**
   * Perform 2-opt swap on path order
   */
  private static swap2Opt(order: number[], i: number, j: number): number[] {
    const newOrder = [...order];
    
    // Reverse the segment between i and j
    while (i < j) {
      [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];
      i++;
      j--;
    }
    
    return newOrder;
  }
  
  /**
   * Calculate total distance for a specific path ordering
   */
  private static calculatePathOrderDistance(paths: Path[], order: number[]): number {
    let totalDistance = 0;
    
    for (let i = 0; i < order.length - 1; i++) {
      const currentPath = paths[order[i]];
      const nextPath = paths[order[i + 1]];
      
      if (currentPath.length > 0 && nextPath.length > 0) {
        const currentEnd = currentPath[currentPath.length - 1];
        const nextStart = nextPath[0];
        totalDistance += this.distance(currentEnd, nextStart);
      }
    }
    
    return totalDistance;
  }
  
  /**
   * Apply greedy improvements to fine-tune the solution
   */
  private static greedyImprovement(paths: Path[]): Path[] {
    if (paths.length <= 2) return paths;
    
    const improved = [...paths];
    let madeImprovement = true;
    
    while (madeImprovement) {
      madeImprovement = false;
      
      // Try swapping adjacent paths
      for (let i = 0; i < improved.length - 1; i++) {
        const originalDistance = this.calculateTravelBetween(
          improved[i], improved[i + 1],
          i > 0 ? improved[i - 1] : null,
          i + 2 < improved.length ? improved[i + 2] : null
        );
        
        // Swap and test
        [improved[i], improved[i + 1]] = [improved[i + 1], improved[i]];
        
        const newDistance = this.calculateTravelBetween(
          improved[i], improved[i + 1],
          i > 0 ? improved[i - 1] : null,
          i + 2 < improved.length ? improved[i + 2] : null
        );
        
        if (newDistance < originalDistance) {
          madeImprovement = true;
        } else {
          // Swap back if no improvement
          [improved[i], improved[i + 1]] = [improved[i + 1], improved[i]];
        }
      }
    }
    
    return improved;
  }
  
  /**
   * Calculate travel distance between two paths considering context
   */
  private static calculateTravelBetween(
    path1: Path,
    path2: Path,
    prevPath: Path | null,
    nextPath: Path | null
  ): number {
    let distance = 0;
    
    // Distance from previous path to path1 (if exists)
    if (prevPath && prevPath.length > 0 && path1.length > 0) {
      distance += this.distance(prevPath[prevPath.length - 1], path1[0]);
    }
    
    // Distance from path1 to path2
    if (path1.length > 0 && path2.length > 0) {
      distance += this.distance(path1[path1.length - 1], path2[0]);
    }
    
    // Distance from path2 to next path (if exists)
    if (path2.length > 0 && nextPath && nextPath.length > 0) {
      distance += this.distance(path2[path2.length - 1], nextPath[0]);
    }
    
    return distance;
  }
  
  /**
   * Calculate total travel distance for all paths
   */
  private static calculateTotalTravelDistance(paths: Path[]): number {
    let totalDistance = 0;
    
    for (let i = 0; i < paths.length - 1; i++) {
      const currentPath = paths[i];
      const nextPath = paths[i + 1];
      
      if (currentPath.length > 0 && nextPath.length > 0) {
        const currentEnd = currentPath[currentPath.length - 1];
        const nextStart = nextPath[0];
        totalDistance += this.distance(currentEnd, nextStart);
      }
    }
    
    return totalDistance;
  }
  
  /**
   * Advanced path simplification using Ramer-Douglas-Peucker with adaptive tolerance
   */
  static advancedSimplification(paths: Path[], baseEpsilon: number = 1.0): Path[] {
    return paths.map(path => this.adaptiveSimplify(path, baseEpsilon));
  }
  
  /**
   * Adaptive simplification that varies tolerance based on path characteristics
   */
  private static adaptiveSimplify(path: Path, baseEpsilon: number): Path {
    if (path.length <= 3) return path;
    
    // Analyze path curvature to determine appropriate epsilon
    const curvature = this.analyzeCurvature(path);
    const adaptiveEpsilon = baseEpsilon * (1 + curvature * 0.5); // Higher tolerance for more curved paths
    
    return this.douglasPeucker(path, adaptiveEpsilon);
  }
  
  /**
   * Analyze the overall curvature of a path
   */
  private static analyzeCurvature(path: Point[]): number {
    if (path.length < 3) return 0;
    
    let totalCurvature = 0;
    let segments = 0;
    
    for (let i = 1; i < path.length - 1; i++) {
      const p1 = path[i - 1];
      const p2 = path[i];
      const p3 = path[i + 1];
      
      // Calculate angle change
      const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      
      const angle1 = Math.atan2(v1.y, v1.x);
      const angle2 = Math.atan2(v2.y, v2.x);
      
      let angleDiff = Math.abs(angle2 - angle1);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      
      totalCurvature += angleDiff;
      segments++;
    }
    
    return segments > 0 ? totalCurvature / segments : 0;
  }
  
  /**
   * Douglas-Peucker line simplification algorithm
   */
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
  
  /**
   * Calculate perpendicular distance from point to line
   */
  private static perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const A = lineEnd.y - lineStart.y;
    const B = lineStart.x - lineEnd.x;
    const C = lineEnd.x * lineStart.y - lineStart.x * lineEnd.y;
    
    return Math.abs(A * point.x + B * point.y + C) / Math.sqrt(A * A + B * B);
  }
  
  /**
   * Calculate distance between two points
   */
  private static distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Analyze optimization results and provide recommendations
   */
  static analyzeOptimization(result: OptimizationResult): string {
    const { totalDistance, improvement } = result;
    
    let analysis = `Path optimization complete:\n`;
    analysis += `• Total travel distance: ${totalDistance.toFixed(1)} units\n`;
    analysis += `• Improvement: ${improvement.toFixed(1)}%\n`;
    
    if (improvement > 20) {
      analysis += `• Excellent optimization! Significant travel time reduction.`;
    } else if (improvement > 10) {
      analysis += `• Good optimization achieved.`;
    } else if (improvement > 5) {
      analysis += `• Modest improvements made.`;
    } else {
      analysis += `• Path order was already quite efficient.`;
    }
    
    return analysis;
  }
}