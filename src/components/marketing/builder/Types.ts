export type BlockType = 'header' | 'hero' | 'products' | 'text' | 'about' | 'contact' | 'mission' | 'footer';

export interface BlockConfig {
  id: string;
  type: BlockType;
  data: any;
}
