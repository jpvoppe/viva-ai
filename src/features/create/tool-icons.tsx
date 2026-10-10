import {
  CalendarRange,
  Clapperboard,
  Hash,
  Lightbulb,
  ListOrdered,
  Mail,
  PartyPopper,
  PenLine,
  Plane,
  Presentation,
  Scale,
  ScrollText,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  mail: Mail,
  hash: Hash,
  clapperboard: Clapperboard,
  scroll: ScrollText,
  tag: Tag,
  party: PartyPopper,
  presentation: Presentation,
  pen: PenLine,
  lightbulb: Lightbulb,
  list: ListOrdered,
  calendar: CalendarRange,
  plane: Plane,
  utensils: Utensils,
  cart: ShoppingCart,
  scale: Scale,
  confetti: PartyPopper,
  smartphone: Smartphone,
};

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon aria-hidden="true" className={className} />;
}
