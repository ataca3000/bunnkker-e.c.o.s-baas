"use client";

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeSVGProps {
  value: string;
  format?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
  background?: string;
  lineColor?: string;
  className?: string;
}

export function BarcodeSVG({
  value,
  format = 'CODE128',
  width = 1.6,
  height = 36,
  displayValue = true,
  fontSize = 10,
  margin = 2,
  background = '#ffffff',
  lineColor = '#000000',
  className = '',
}: BarcodeSVGProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        // Clean value or fallback to value
        const cleanVal = String(value).trim() || '000000000000';
        JsBarcode(svgRef.current, cleanVal, {
          format: format || 'CODE128',
          width,
          height,
          displayValue,
          fontSize,
          margin,
          font: 'monospace',
          textAlign: 'center',
          textPosition: 'bottom',
          textMargin: 2,
          background,
          lineColor,
          valid: (valid) => {
            if (!valid && svgRef.current) {
              // Fallback to CODE128 if EAN/UPC fails validation
              try {
                JsBarcode(svgRef.current, cleanVal, {
                  format: 'CODE128',
                  width,
                  height,
                  displayValue,
                  fontSize,
                  margin,
                  font: 'monospace',
                  background,
                  lineColor,
                });
              } catch (e) {
                console.warn('Barcode fallback error:', e);
              }
            }
          }
        });
      } catch (err) {
        console.warn('JsBarcode render error:', err);
      }
    }
  }, [value, format, width, height, displayValue, fontSize, margin, background, lineColor]);

  return <svg ref={svgRef} className={`inline-block max-w-full ${className}`} />;
}

export default BarcodeSVG;
