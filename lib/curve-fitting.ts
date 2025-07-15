// Professional Bézier Curve Fitting and Path Optimization
// Transforms jagged polylines into smooth, elegant curves

export interface Point {
  x: number;
  y: number;
}

export interface BezierCurve {
  start: Point;
  control1: Point;
  control2: Point;
  end: Point;
  type: 'bezier';
}

export interface Arc {
  start: Point;
  end: Point;
  center: Point;
  radius: number;
  clockwise: boolean;
  type: 'arc';
}

export type CurveSegment = BezierCurve | Arc;

export class CurveFitter {
  
  /**
   * Fits smooth Bézier curves to a polyline path
   * Uses a simplified Potrace-inspired algorithm
   */
  static fitCurves(points: Point[], tolerance: number = 2.0): CurveSegment[] {
    if (points.length < 3) return [];
    
    const curves: CurveSegment[] = [];
    let i = 0;
    
    while (i < points.length - 1) {
      // Try to fit the longest possible curve from current position
      let bestFit = this.findBestCurveFit(points, i, tolerance);
      
      if (bestFit) {
        curves.push(bestFit.curve);
        i = bestFit.endIndex;
      } else {
        // Fallback: create a short curve or line
        if (i < points.length - 2) {
          const simpleCurve = this.createSimpleBezier(points[i], points[i + 1], points[i + 2]);
          curves.push(simpleCurve);
          i += 2;
        } else {
          i++;
        }
      }
    }
    
    return curves;
  }
  
  /**
   * Finds the best Bézier curve fit for a segment of points
   */
  private static findBestCurveFit(
    points: Point[], 
    startIndex: number, 
    tolerance: number
  ): { curve: BezierCurve; endIndex: number } | null {
    
    const maxSegmentLength = Math.min(points.length - startIndex, 20); // Limit for performance
    let bestFit: { curve: BezierCurve; endIndex: number; error: number } | null = null;
    
    // Try different end points, starting from the longest possible curve
    for (let length = maxSegmentLength; length >= 3; length--) {
      const endIndex = startIndex + length - 1;
      if (endIndex >= points.length) continue;
      
      const segment = points.slice(startIndex, endIndex + 1);
      const curve = this.fitBezierToPoints(segment);
      const error = this.calculateCurveError(segment, curve);
      
      if (error <= tolerance) {
        bestFit = { curve, endIndex, error };
        break; // Take the first (longest) fit within tolerance
      }
    }
    
    return bestFit ? { curve: bestFit.curve, endIndex: bestFit.endIndex } : null;
  }
  
  /**
   * Fits a Bézier curve to a set of points using least squares
   */
  private static fitBezierToPoints(points: Point[]): BezierCurve {
    const n = points.length;
    if (n < 3) {
      // Fallback for too few points
      return this.createSimpleBezier(points[0], points[1] || points[0], points[2] || points[1] || points[0]);
    }
    
    const start = points[0];
    const end = points[n - 1];
    
    // Calculate tangent vectors at start and end
    const startTangent = this.calculateTangent(points, 0);
    const endTangent = this.calculateTangent(points, n - 1);
    
    // Estimate control points using chord length parameterization
    const alpha = 0.3; // Control point distance factor
    const startLength = this.distance(start, end) * alpha;
    const endLength = this.distance(start, end) * alpha;
    
    const control1: Point = {
      x: start.x + startTangent.x * startLength,
      y: start.y + startTangent.y * startLength
    };
    
    const control2: Point = {
      x: end.x - endTangent.x * endLength,
      y: end.y - endTangent.y * endLength
    };
    
    // Optimize control points using least squares
    const optimized = this.optimizeControlPoints(points, start, control1, control2, end);
    
    return {
      start,
      control1: optimized.control1,
      control2: optimized.control2,
      end,
      type: 'bezier'
    };
  }
  
  /**
   * Calculate tangent direction at a point
   */
  private static calculateTangent(points: Point[], index: number): Point {
    const n = points.length;
    let tangent: Point;
    
    if (index === 0) {
      // Forward difference at start
      tangent = {
        x: points[1].x - points[0].x,
        y: points[1].y - points[0].y
      };
    } else if (index === n - 1) {
      // Backward difference at end
      tangent = {
        x: points[n - 1].x - points[n - 2].x,
        y: points[n - 1].y - points[n - 2].y
      };
    } else {
      // Central difference in middle
      tangent = {
        x: points[index + 1].x - points[index - 1].x,
        y: points[index + 1].y - points[index - 1].y
      };
    }
    
    // Normalize
    const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
    if (length > 0) {
      tangent.x /= length;
      tangent.y /= length;
    }
    
    return tangent;
  }
  
  /**
   * Optimize control points using iterative improvement
   */
  private static optimizeControlPoints(
    points: Point[],
    start: Point,
    control1: Point,
    control2: Point,
    end: Point
  ): { control1: Point; control2: Point } {
    
    let bestC1 = control1;
    let bestC2 = control2;
    let bestError = this.calculateCurveError(points, { start, control1, control2, end, type: 'bezier' });
    
    // Simple gradient descent-like optimization
    const step = 0.5;
    const iterations = 5;
    
    for (let iter = 0; iter < iterations; iter++) {
      // Try small perturbations of control points
      const perturbations = [
        { dx: step, dy: 0 }, { dx: -step, dy: 0 },
        { dx: 0, dy: step }, { dx: 0, dy: -step },
        { dx: step, dy: step }, { dx: -step, dy: -step },
        { dx: step, dy: -step }, { dx: -step, dy: step }
      ];
      
      for (const p1 of perturbations) {
        for (const p2 of perturbations) {
          const newC1 = { x: bestC1.x + p1.dx, y: bestC1.y + p1.dy };
          const newC2 = { x: bestC2.x + p2.dx, y: bestC2.y + p2.dy };
          
          const curve = { start, control1: newC1, control2: newC2, end, type: 'bezier' as const };
          const error = this.calculateCurveError(points, curve);
          
          if (error < bestError) {
            bestC1 = newC1;
            bestC2 = newC2;
            bestError = error;
          }
        }
      }
    }
    
    return { control1: bestC1, control2: bestC2 };
  }
  
  /**
   * Calculate error between points and Bézier curve
   */
  private static calculateCurveError(points: Point[], curve: BezierCurve): number {
    let totalError = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1); // Parameter along curve
      const curvePoint = this.evaluateBezier(curve, t);
      const error = this.distance(points[i], curvePoint);
      totalError += error * error; // Squared error
    }
    
    return Math.sqrt(totalError / n); // RMS error
  }
  
  /**
   * Evaluate Bézier curve at parameter t
   */
  private static evaluateBezier(curve: BezierCurve, t: number): Point {
    const { start, control1, control2, end } = curve;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    
    return {
      x: uuu * start.x + 3 * uu * t * control1.x + 3 * u * tt * control2.x + ttt * end.x,
      y: uuu * start.y + 3 * uu * t * control1.y + 3 * u * tt * control2.y + ttt * end.y
    };
  }
  
  /**
   * Create a simple Bézier curve through three points
   */
  private static createSimpleBezier(p0: Point, p1: Point, p2: Point): BezierCurve {
    // Place control points to create a smooth curve through the middle point
    const control1 = {
      x: p0.x + (p1.x - p0.x) * 0.5,
      y: p0.y + (p1.y - p0.y) * 0.5
    };
    
    const control2 = {
      x: p1.x + (p2.x - p1.x) * 0.5,
      y: p1.y + (p2.y - p1.y) * 0.5
    };
    
    return {
      start: p0,
      control1,
      control2,
      end: p2,
      type: 'bezier'
    };
  }
  
  /**
   * Try to convert Bézier curves to circular arcs where possible
   * This enables G2/G3 G-code generation
   */
  static convertToArcs(curves: CurveSegment[], tolerance: number = 1.0): CurveSegment[] {
    return curves.map(curve => {
      if (curve.type === 'arc') return curve;
      
      const arc = this.tryConvertBezierToArc(curve as BezierCurve, tolerance);
      return arc || curve;
    });
  }
  
  /**
   * Attempt to convert a Bézier curve to a circular arc
   */
  private static tryConvertBezierToArc(bezier: BezierCurve, tolerance: number): Arc | null {
    // Sample points along the Bézier curve
    const samples = 10;
    const points: Point[] = [];
    
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      points.push(this.evaluateBezier(bezier, t));
    }
    
    // Try to fit a circle to these points
    const circle = this.fitCircleToPoints(points);
    if (!circle) return null;
    
    // Check if the circle approximation is within tolerance
    let maxError = 0;
    for (const point of points) {
      const distToCenter = this.distance(point, circle.center);
      const error = Math.abs(distToCenter - circle.radius);
      maxError = Math.max(maxError, error);
    }
    
    if (maxError <= tolerance) {
      // Determine if the arc is clockwise or counter-clockwise
      const midPoint = this.evaluateBezier(bezier, 0.5);
      const startToMid = { x: midPoint.x - bezier.start.x, y: midPoint.y - bezier.start.y };
      const startToEnd = { x: bezier.end.x - bezier.start.x, y: bezier.end.y - bezier.start.y };
      const cross = startToMid.x * startToEnd.y - startToMid.y * startToEnd.x;
      
      return {
        start: bezier.start,
        end: bezier.end,
        center: circle.center,
        radius: circle.radius,
        clockwise: cross < 0,
        type: 'arc'
      };
    }
    
    return null;
  }
  
  /**
   * Fit a circle to a set of points using least squares
   */
  private static fitCircleToPoints(points: Point[]): { center: Point; radius: number } | null {
    if (points.length < 3) return null;
    
    // Use algebraic circle fitting (simpler than geometric)
    // Circle equation: (x-a)² + (y-b)² = r²
    // Expanded: x² + y² - 2ax - 2by + (a² + b² - r²) = 0
    
    let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
    let sumX3 = 0, sumY3 = 0, sumX2Y = 0, sumXY2 = 0;
    
    for (const p of points) {
      const x = p.x, y = p.y;
      const x2 = x * x, y2 = y * y;
      
      sumX += x;
      sumY += y;
      sumX2 += x2;
      sumY2 += y2;
      sumXY += x * y;
      sumX3 += x2 * x;
      sumY3 += y2 * y;
      sumX2Y += x2 * y;
      sumXY2 += x * y2;
    }
    
    const n = points.length;
    const A = n * sumX2 - sumX * sumX;
    const B = n * sumXY - sumX * sumY;
    const C = n * sumY2 - sumY * sumY;
    const D = 0.5 * (n * sumX2Y - sumX * sumXY + n * sumX3 - sumX * sumX2);
    const E = 0.5 * (n * sumXY2 - sumY * sumXY + n * sumY3 - sumY * sumY2);
    
    const det = A * C - B * B;
    if (Math.abs(det) < 1e-10) return null; // Degenerate case
    
    const centerX = (D * C - B * E) / det;
    const centerY = (A * E - B * D) / det;
    
    // Calculate radius as average distance to center
    let sumDist = 0;
    for (const p of points) {
      sumDist += this.distance(p, { x: centerX, y: centerY });
    }
    const radius = sumDist / n;
    
    return {
      center: { x: centerX, y: centerY },
      radius
    };
  }
  
  /**
   * Calculate distance between two points
   */
  private static distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}