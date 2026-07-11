import type { EntryTypeTag } from "@papyru/bibliography";
import { isKnownEntryType } from "@papyru/bibliography";
import {
  BookOpen,
  FileQuestion,
  FileText,
  GraduationCap,
  Layers,
  Presentation,
} from "lucide-react";

const ICON_BY_TYPE: Record<string, typeof FileText> = {
  article: FileText,
  book: BookOpen,
  inproceedings: Presentation,
  incollection: Layers,
  phdthesis: GraduationCap,
  mastersthesis: GraduationCap,
  techreport: FileText,
  unpublished: FileText,
  misc: FileQuestion,
};

export function EntryTypeIcon({
  type,
  className,
}: {
  type: EntryTypeTag;
  className?: string;
}) {
  const Icon = (isKnownEntryType(type) && ICON_BY_TYPE[type]) || FileQuestion;
  return <Icon className={className ?? "size-3.5"} aria-hidden="true" />;
}
