declare module 'lucide-react' {
  import type { FC, SVGProps } from 'react';

  export interface LucideProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = FC<LucideProps>;

  // Export all commonly used icons
  export const ChevronDown: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Plus: LucideIcon;
  export const Minus: LucideIcon;
  export const X: LucideIcon;
  export const Check: LucideIcon;
  export const Search: LucideIcon;
  export const Menu: LucideIcon;
  export const Settings: LucideIcon;
  export const User: LucideIcon;
  export const Home: LucideIcon;
  export const File: LucideIcon;
  export const FileText: LucideIcon;
  export const Folder: LucideIcon;
  export const Download: LucideIcon;
  export const Upload: LucideIcon;
  export const Copy: LucideIcon;
  export const Trash: LucideIcon;
  export const Edit: LucideIcon;
  export const Save: LucideIcon;
  export const Send: LucideIcon;
  export const Mail: LucideIcon;
  export const Phone: LucideIcon;
  export const Calendar: LucideIcon;
  export const Clock: LucideIcon;
  export const Heart: LucideIcon;
  export const Star: LucideIcon;
  export const Info: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const XCircle: LucideIcon;
  export const Circle: LucideIcon;
  export const PanelLeft: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const Lock: LucideIcon;
  export const Unlock: LucideIcon;
  export const LogIn: LucideIcon;
  export const LogOut: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const MoreVertical: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const Link: LucideIcon;
  export const Loader: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowUp: LucideIcon;
  export const ArrowDown: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const Quote: LucideIcon;
  export const Share: LucideIcon;
  export const Bookmark: LucideIcon;
  export const Tag: LucideIcon;
  export const Filter: LucideIcon;
  export const SortAsc: LucideIcon;
  export const SortDesc: LucideIcon;
  export const Grid: LucideIcon;
  export const List: LucideIcon;
  export const Image: LucideIcon;
  export const Video: LucideIcon;
  export const Music: LucideIcon;
  export const Mic: LucideIcon;
  export const MicOff: LucideIcon;
  export const Volume: LucideIcon;
  export const VolumeOff: LucideIcon;
  export const Play: LucideIcon;
  export const Pause: LucideIcon;
  export const Stop: LucideIcon;
  export const SkipBack: LucideIcon;
  export const SkipForward: LucideIcon;
  export const Repeat: LucideIcon;
  export const Shuffle: LucideIcon;
  export const Bell: LucideIcon;
  export const BellOff: LucideIcon;
  export const Globe: LucideIcon;
  export const Wifi: LucideIcon;
  export const WifiOff: LucideIcon;
  export const Battery: LucideIcon;
  export const Zap: LucideIcon;
  export const Sun: LucideIcon;
  export const Moon: LucideIcon;
  export const Cloud: LucideIcon;
  export const Umbrella: LucideIcon;
  export const MapPin: LucideIcon;
  export const Navigation: LucideIcon;
  export const Compass: LucideIcon;
  export const Car: LucideIcon;
  export const Truck: LucideIcon;
  export const Plane: LucideIcon;
  export const Ship: LucideIcon;
  export const Train: LucideIcon;
  export const Bike: LucideIcon;
  export const Laptop: LucideIcon;
  export const Smartphone: LucideIcon;
  export const Tablet: LucideIcon;
  export const Monitor: LucideIcon;
  export const Printer: LucideIcon;
  export const Camera: LucideIcon;
  export const Headphones: LucideIcon;
  export const Database: LucideIcon;
  export const Server: LucideIcon;
  export const HardDrive: LucideIcon;
  export const Cpu: LucideIcon;
  export const MemoryStick: LucideIcon;
  export const Usb: LucideIcon;
  export const Bluetooth: LucideIcon;
  export const Gamepad: LucideIcon;
  export const Joystick: LucideIcon;
  export const Trophy: LucideIcon;
  export const Award: LucideIcon;
  export const Medal: LucideIcon;
  export const Gift: LucideIcon;
  export const Package: LucideIcon;
  export const ShoppingCart: LucideIcon;
  export const ShoppingBag: LucideIcon;
  export const CreditCard: LucideIcon;
  export const DollarSign: LucideIcon;
  export const PoundSterling: LucideIcon;
  export const Euro: LucideIcon;
  export const Yen: LucideIcon;
  export const Bitcoin: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const BarChart: LucideIcon;
  export const LineChart: LucideIcon;
  export const PieChart: LucideIcon;
  export const Activity: LucideIcon;
  export const Target: LucideIcon;
  export const Crosshair: LucideIcon;
  export const Focus: LucideIcon;
  export const Maximize: LucideIcon;
  export const Minimize: LucideIcon;
  export const RotateCcw: LucideIcon;
  export const RotateCw: LucideIcon;
  export const FlipHorizontal: LucideIcon;
  export const FlipVertical: LucideIcon;
  export const Move: LucideIcon;
  export const MousePointer: LucideIcon;
  export const Hand: LucideIcon;
  export const Fingerprint: LucideIcon;
  export const Scan: LucideIcon;
  export const QrCode: LucideIcon;
  export const Barcode: LucideIcon;
  export const Ruler: LucideIcon;
  export const Calculator: LucideIcon;
  export const Clipboard: LucideIcon;
  export const ClipboardCheck: LucideIcon;
  export const ClipboardCopy: LucideIcon;
  export const ClipboardList: LucideIcon;
  export const Scissors: LucideIcon;
  export const PenTool: LucideIcon;
  export const Brush: LucideIcon;
  export const Palette: LucideIcon;
  export const Paintbrush: LucideIcon;
  export const Eraser: LucideIcon;
  export const Type: LucideIcon;
  export const AlignLeft: LucideIcon;
  export const AlignCenter: LucideIcon;
  export const AlignRight: LucideIcon;
  export const AlignJustify: LucideIcon;
  export const Bold: LucideIcon;
  export const Italic: LucideIcon;
  export const Underline: LucideIcon;
  export const Strikethrough: LucideIcon;
  export const Code: LucideIcon;
  export const Terminal: LucideIcon;
  export const Command: LucideIcon;
  export const Hash: LucideIcon;
  export const AtSign: LucideIcon;
  export const Percent: LucideIcon;
  export const Ampersand: LucideIcon;
  export const Asterisk: LucideIcon;
  export const Slash: LucideIcon;
  export const Equal: LucideIcon;
  export const NotEqual: LucideIcon;
  export const GreaterThan: LucideIcon;
  export const LessThan: LucideIcon;
  export const GreaterThanEqual: LucideIcon;
  export const LessThanEqual: LucideIcon;
  export const InfinityIcon: LucideIcon;
  export const Pi: LucideIcon;
  export const Sigma: LucideIcon;
  export const Alpha: LucideIcon;
  export const Beta: LucideIcon;
  export const Gamma: LucideIcon;
  export const Delta: LucideIcon;
  export const Lambda: LucideIcon;
  export const Mu: LucideIcon;
  export const Omega: LucideIcon;
  export const Phi: LucideIcon;
  export const Psi: LucideIcon;
  export const Theta: LucideIcon;
  export const Xi: LucideIcon;
  export const Zeta: LucideIcon;

  // Fallback for any other icons
  const lucideReact: Record<string, LucideIcon>;
  export default lucideReact;
}

declare module 'lucide-react/dist/esm/icons/*' {
  import type { LucideIcon } from 'lucide-react';
  const icon: LucideIcon;
  export default icon;
}
