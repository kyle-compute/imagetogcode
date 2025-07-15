# Image to G-Code Converter

A Next.js application that converts images to G-code for CNC machines using OpenCV.js vectorization.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Installation

```bash
git clone <repository-url>
cd image-to-gcode-next
npm install
```

## Running the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Color Region Vectorization**: Converts images to distinct color regions
- **Centerline Extraction**: Extracts centerlines from line art
- **Hatching Patterns**: Generates crosshatch patterns for filled areas
- **Path Optimization**: Optimizes tool paths for efficient machining
- **G-code Export**: Exports ready-to-use G-code files

## Usage

1. Upload an image file
2. Select vectorization mode
3. Adjust parameters (scale, colors, spacing, etc.)
4. Process the image
5. Download the generated G-code file

## Build for Production

```bash
npm run build
```

## Technology Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- OpenCV.js
- Radix UI components