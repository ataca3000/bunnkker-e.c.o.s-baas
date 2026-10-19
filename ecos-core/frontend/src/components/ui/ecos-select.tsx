/**
 * ECOS Select — enterprise standard for static option lists.
 *
 * Built on Radix UI Select which renders via Portal natively, so it is never
 * clipped by Dialog, Drawer, or Sheet. Use this for short, known-at-compile-time
 * option sets. For searchable or async lists, use EcosCombobox instead.
 *
 * All modules must import from this path rather than '@/components/ui/select'
 * directly, so the standard can evolve in one place.
 */
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
