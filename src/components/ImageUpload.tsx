// src/components/ImageUpload.tsx
'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';

interface ImageUploadProps {
  onUpload: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  accept?: Record<string, string[]>;
}

export function ImageUpload({ 
  onUpload, 
  maxFiles = 1, 
  maxSize = 5,
  accept = { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }
}: ImageUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate file size
    const validFiles = selectedFiles.filter(file => {
      const sizeMB = file.size / (1024 * 1024);
      return sizeMB <= maxSize;
    });

    if (validFiles.length !== selectedFiles.length) {
      alert(`Some files were too large. Maximum size is ${maxSize}MB`);
    }

    // Limit number of files
    const limitedFiles = validFiles.slice(0, maxFiles);
    
    // Create previews
    const newPreviews = limitedFiles.map(file => URL.createObjectURL(file));
    
    setFiles(limitedFiles);
    setPreviews(newPreviews);
    onUpload(limitedFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    
    // Revoke object URL
    URL.revokeObjectURL(previews[index]);
    
    setFiles(newFiles);
    setPreviews(newPreviews);
    onUpload(newFiles);
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={Object.values(accept).flat().join(',')}
          onChange={handleFileChange}
          className="hidden"
        />
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
        <p className="text-xs text-gray-500 mt-1">
          Max {maxFiles} file{maxFiles > 1 ? 's' : ''}, up to {maxSize}MB each
        </p>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <Image
                src={preview}
                alt={`Preview ${index + 1}`}
                width={320}
                height={128}
                className="w-full h-32 object-cover rounded-lg"
                unoptimized
              />
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
