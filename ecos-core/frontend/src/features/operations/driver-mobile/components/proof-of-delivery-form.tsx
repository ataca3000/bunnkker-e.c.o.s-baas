import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2 } from 'lucide-react';

interface ProofOfDeliveryFormProps {
  onSubmit: (payload: {
    signature_path?: string;
    photos?: string[];
    notes?: string;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProofOfDeliveryForm({ onSubmit, onCancel, isLoading }: ProofOfDeliveryFormProps) {
  const [signature, setSignature] = useState('');
  const [photos, setPhotos]       = useState<string[]>(['']);
  const [notes, setNotes]         = useState('');

  function addPhoto() {
    setPhotos((prev) => [...prev, '']);
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePhoto(idx: number, val: string) {
    setPhotos((prev) => prev.map((p, i) => (i === idx ? val : p)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      signature_path: signature || undefined,
      photos:         photos.filter(Boolean),
      notes:          notes || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Signature Image URL</Label>
        <Input
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="https://... (upload link)"
        />
      </div>

      <div className="space-y-2">
        <Label>Photos</Label>
        {photos.map((photo, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              value={photo}
              onChange={(e) => updatePhoto(idx, e.target.value)}
              placeholder={`Photo URL ${idx + 1}...`}
              className="flex-1"
            />
            {photos.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removePhoto(idx)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addPhoto} className="gap-1">
          <PlusCircle className="h-4 w-4" />
          Add Photo
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Delivery notes..."
          rows={2}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Proof of Delivery'}
        </Button>
      </div>
    </form>
  );
}
