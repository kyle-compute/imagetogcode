// FILE: ImageProcessor.tsx

"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateGCode } from "@/lib/gcode";
import { VectorizationEngine, VectorizationMode, Path } from "@/lib/vectorization-engine"; 

declare const cv: any;

export function ImageProcessor() {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isOpenCVReady, setIsOpenCVReady] = useState<boolean>(false);
  
  // --- STATE FOR CONTROLS ---
  const [mode, setMode] = useState<VectorizationMode>(VectorizationMode.COLOR_REGIONS);
  const [scale, setScale] = useState<number>(90);
  
  // Strategy A options
  const [numColors, setNumColors] = useState<number>(8);
  
  // Strategy B options
  const [centerlineThreshold, setCenterlineThreshold] = useState<number>(127);
  const [centerlineProximity, setCenterlineProximity] = useState<number>(5);
  
  // Strategy C options
  const [hatchSpacing, setHatchSpacing] = useState<number>(5);
  const [hatchAngle, setHatchAngle] = useState<number>(45);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check for OpenCV availability
  useEffect(() => {
    const checkOpenCV = () => {
      if (typeof cv !== 'undefined' && cv.imread) {
        setIsOpenCVReady(true);
        console.log('OpenCV.js is ready for multi-strategy processing');
      } else {
        setTimeout(checkOpenCV, 100);
      }
    };
    checkOpenCV();
  }, []);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Load original image whenever it's uploaded
  useEffect(() => {
    if (image && canvasRef.current && imgRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      const img = imgRef.current;
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      };
      img.src = image;
    }
  }, [image]);

  const processAndPreview = () => {
    if (!canvasRef.current || !image || !imgRef.current || !isOpenCVReady) {
      alert("Please upload an image and wait for OpenCV to load.");
      return;
    }
    
    setIsProcessing(true);
    
    setTimeout(() => {
      // Redraw original image to canvas before processing
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const img = imgRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const options = {
        numColors,
        threshold: centerlineThreshold,
        proximity: centerlineProximity,
        hatchSpacing,
        hatchAngle,
      };

      console.log(`Processing with ${mode} strategy...`);
      const paths = VectorizationEngine.process(canvas, mode, options);
      const sortedPaths = VectorizationEngine.sortPathsForPrinting(paths);
      
      // Render Preview
      if (sortedPaths.length > 0) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = "#e74c3c";
        ctx.lineWidth = 1.5;

        sortedPaths.forEach((path, index) => {
          if (path.length < 2) return;
          
          ctx.beginPath();
          ctx.moveTo(path[0].x, path[0].y);
          
          for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
          }
          
          ctx.stroke();
          
          // Draw start point for path ordering visualization
          ctx.fillStyle = "#27ae60";
          ctx.beginPath();
          ctx.arc(path[0].x, path[0].y, 2, 0, 2 * Math.PI);
          ctx.fill();
        });
        
        console.log(`Preview rendered ${sortedPaths.length} paths with ${sortedPaths.reduce((sum, path) => sum + path.length, 0)} total points`);
      } else {
        console.log("No paths were generated for the current settings.");
        alert("No paths found. Try adjusting the parameters for the selected mode.");
      }

      setIsProcessing(false);
    }, 100);
  };

  const generateAndDownloadGCode = () => {
    if (!canvasRef.current || !image || !imgRef.current || !isOpenCVReady) {
      alert("Please upload an image and wait for OpenCV to load.");
      return;
    }
    
    setIsProcessing(true);
    
    setTimeout(() => {
      // Redraw original image to canvas before processing
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const img = imgRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const options = {
        numColors,
        threshold: centerlineThreshold,
        proximity: centerlineProximity,
        hatchSpacing,
        hatchAngle,
      };

      const paths = VectorizationEngine.process(canvas, mode, options);
      const sortedPaths = VectorizationEngine.sortPathsForPrinting(paths);
      
      if (sortedPaths.length > 0) {
        // Update preview
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = "#e74c3c";
        ctx.lineWidth = 1.5;

        sortedPaths.forEach(path => {
          if (path.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
          }
          ctx.stroke();
          
          ctx.fillStyle = "#27ae60";
          ctx.beginPath();
          ctx.arc(path[0].x, path[0].y, 2, 0, 2 * Math.PI);
          ctx.fill();
        });

        // Generate and download G-code
        const gcode = generateGCode(sortedPaths, scale);
        const blob = new Blob([gcode], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${mode.toLowerCase().replace(/\s+/g, '_')}_drawing.gcode`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`Generated G-code with ${sortedPaths.length} optimized paths using ${mode} strategy.`);
      } else {
        alert("No paths found. Try adjusting the parameters for the selected mode.");
      }

      setIsProcessing(false);
    }, 100);
  };
  
  const renderControls = () => {
    switch (mode) {
      case VectorizationMode.COLOR_REGIONS:
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Number of Colors: {numColors}</Label>
              <Slider 
                value={[numColors]} 
                onValueChange={(v) => setNumColors(v[0])} 
                min={2} 
                max={32} 
                step={1}
                className="py-2"
              />
              <p className="text-xs text-gray-500">Quantizes image into distinct color regions for tracing</p>
            </div>
          </div>
        );
      case VectorizationMode.CENTERLINE:
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Threshold: {centerlineThreshold}</Label>
              <Slider 
                value={[centerlineThreshold]} 
                onValueChange={(v) => setCenterlineThreshold(v[0])} 
                max={255}
                className="py-2"
              />
              <p className="text-xs text-gray-500">Grayscale threshold for line detection</p>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Stitching Proximity: {centerlineProximity}</Label>
              <Slider 
                value={[centerlineProximity]} 
                onValueChange={(v) => setCenterlineProximity(v[0])} 
                max={20}
                className="py-2"
              />
              <p className="text-xs text-gray-500">How close line segments must be to connect</p>
            </div>
          </div>
        );
      case VectorizationMode.HATCHING:
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Tone Levels: {numColors}</Label>
              <Slider 
                value={[numColors]} 
                onValueChange={(v) => setNumColors(v[0])} 
                min={2} 
                max={16} 
                step={1}
                className="py-2"
              />
              <p className="text-xs text-gray-500">Number of shading levels to generate</p>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Hatch Spacing: {hatchSpacing}px</Label>
              <Slider 
                value={[hatchSpacing]} 
                onValueChange={(v) => setHatchSpacing(v[0])} 
                min={1} 
                max={20}
                className="py-2"
              />
              <p className="text-xs text-gray-500">Distance between parallel hatch lines</p>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Hatch Angle: {hatchAngle}°</Label>
              <Slider 
                value={[hatchAngle]} 
                onValueChange={(v) => setHatchAngle(v[0])} 
                min={0} 
                max={180}
                className="py-2"
              />
              <p className="text-xs text-gray-500">Angle of hatching lines</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Vectorization stuff</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="image-upload" className="text-sm font-semibold">Upload Image</Label>
            <Input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} />
          </div>
          
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Vectorization Strategy</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as VectorizationMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(VectorizationMode).map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500">
              {mode === VectorizationMode.COLOR_REGIONS && "for general art"}
              {mode === VectorizationMode.CENTERLINE && "b&w line art and sketches"}
              {mode === VectorizationMode.HATCHING && "photos"}
            </div>
          </div>
          
          {renderControls()}
          
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Output Scale: {scale}%</Label>
            <Slider 
              value={[scale]} 
              onValueChange={(v) => setScale(v[0])} 
              min={10} 
              max={200} 
              step={5}
              className="py-2"
            />
            <p className="text-xs text-gray-500">Size of final G-code output relative to image</p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={processAndPreview} 
              disabled={!image || isProcessing || !isOpenCVReady} 
              variant="outline"
            >
              {isProcessing ? "Processing..." : "Update Preview"}
            </Button>
            <Button 
              onClick={generateAndDownloadGCode} 
              disabled={!image || isProcessing || !isOpenCVReady}
            >
              {isProcessing ? "Processing..." : !isOpenCVReady ? "Loading OpenCV..." : "Generate & Download G-Code"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-square w-full bg-muted">
            {/* Hidden img tag is used as the source for the canvas */}
            <img ref={imgRef} className="hidden" alt="source"/>
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}