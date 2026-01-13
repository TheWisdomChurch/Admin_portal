// src/components/admin/ImageUpload.tsx
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/ui/Button';

interface ImageUploadProps {
  onUpload: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in MB
  accept?: Record<string, string[]>;
}

export function ImageUpload({
  onUpload,
  multiple = false,
  maxFiles = 1,
  maxSize = 5,
  accept = { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
}: ImageUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>('');

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError('');

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0].code === 'file-too-large') {
          setError(`File size must be less than ${maxSize}MB`);
        } else if (rejection.errors[0].code === 'file-invalid-type') {
          setError('Invalid file type');
        }
        return;
      }

      if (!multiple && acceptedFiles.length > 1) {
        setError('Only one file allowed');
        return;
      }

      if (files.length + acceptedFiles.length > maxFiles) {
        setError(`Maximum ${maxFiles} file(s) allowed`);
        return;
      }

      const newFiles = [...files, ...acceptedFiles];
      setFiles(newFiles);
      onUpload(newFiles);
    },
    [files, maxFiles, maxSize, multiple, onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    maxFiles,
    maxSize: maxSize * 1024 * 1024,
    accept,
  });

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onUpload(newFiles);
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-secondary-300 hover:border-primary-400'}
          ${error ? 'border-red-500' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto text-secondary-400 mb-4" />
        <p className="text-lg font-medium text-secondary-700 mb-2">
          {isDragActive ? 'Drop files here' : 'Drag & drop files or click to browse'}
        </p>
        <p className="text-sm text-secondary-500">
          Upload images (max {maxSize}MB each)
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* File previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {files.map((file, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-secondary-100">
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-secondary-400" />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="opacity-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-secondary-600 truncate">{file.name}</p>
              <p className="text-xs text-secondary-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}