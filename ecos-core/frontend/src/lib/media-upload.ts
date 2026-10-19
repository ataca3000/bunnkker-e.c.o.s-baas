import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

type UploadContext = 'raw-materials' | 'products' | 'packaging-materials' | 'brands' | 'companies' | 'business-accounts';

type UploadResult = {
  path: string;
  url:  string;
};

async function uploadImage(file: File, context: UploadContext): Promise<{ path: string; url: string }> {
  const body = new FormData();
  body.append('file', file);
  body.append('context', context);

  const { data } = await api.post<ApiResponse<UploadResult>>('/media/upload', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data.data;
}

/**
 * Upload an image file to Laravel public storage.
 * Returns the relative storage path (suitable for saving in DB as image_url).
 */
export function uploadMaterialImage(
  file: File,
  context: UploadContext = 'raw-materials',
): Promise<{ path: string; url: string }> {
  return uploadImage(file, context);
}

export function uploadOrgImage(
  file: File,
  context: 'brands' | 'companies' | 'business-accounts',
): Promise<{ path: string; url: string }> {
  return uploadImage(file, context);
}
