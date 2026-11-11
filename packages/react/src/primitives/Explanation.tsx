import { BookOpen } from "lucide-react";
import { RichText } from "./RichText";
import { useTranslator } from "../context/NibblearnProvider";

export function Explanation({
  text,
  title,
  className,
}: {
  text?: string;
  title?: string;
  className?: string;
}) {
  const t = useTranslator();
  if (!text) return null;
  return (
    <div className={["nb-explanation", className].filter(Boolean).join(" ")}>
      <div className="nb-explanation__title">
        <BookOpen aria-hidden />
        {title ?? t("common.explanation")}
      </div>
      <RichText text={text} paragraphs />
    </div>
  );
}
