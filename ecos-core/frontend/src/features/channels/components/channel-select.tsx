import { Combobox } from '@/components/crud';
import { useChannelOptions } from '@/features/channels/hooks/use-channel-options';

type ChannelSelectProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function ChannelSelect({ value, onChange, placeholder, disabled, className }: ChannelSelectProps) {
  const { data: options = [], isLoading } = useChannelOptions();

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? 'Select channel...'}
      loading={isLoading}
      disabled={disabled}
      className={className}
    />
  );
}
