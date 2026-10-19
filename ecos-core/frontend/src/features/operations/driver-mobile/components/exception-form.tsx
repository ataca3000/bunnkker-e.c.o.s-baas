import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXCEPTION_TYPE_LABELS } from '../types/driver-mobile';
import type { ExceptionType } from '../types/driver-mobile';

interface ExceptionFormProps {
  onSubmit: (payload: { exception_type: ExceptionType; description: string; photos: string[] }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ExceptionForm({ onSubmit, onCancel, isLoading }: ExceptionFormProps) {
  const [exType, setExType]         = useState<ExceptionType>('damaged');
  const [description, setDesc]      = useState('');
  const [photos, setPhotos]         = useState<string[]>(['']);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      exception_type: exType,
      description,
      photos: photos.filter(Boolean),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Exception Type *</Label>
        <Select value={exType} onValueChange={(v) => setExType(v as ExceptionType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(EXCEPTION_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Description *</Label>
        <Textarea
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Exception description..."
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Photos (URLs)</Label>
        {photos.map((photo, idx) => (
          <Input
            key={idx}
            value={photo}
            onChange={(e) =>
              setPhotos((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))
            }
            placeholder={`Photo URL ${idx + 1}...`}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPhotos((prev) => [...prev, ''])}
        >
          + Add Photo
        </Button>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Report Exception'}
        </Button>
      </div>
    </form>
  );
}
