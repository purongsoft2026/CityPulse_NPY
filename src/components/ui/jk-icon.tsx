import React from "react";
import { cn } from "@/lib/utils";

export interface JKIconProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  type?: "solid" | "regular" | "light" | "thin" | "duotone" | "sharp-solid" | "brands";
  className?: string;
}

export function JKIcon({ name, type = "solid", className, ...props }: JKIconProps) {
  let prefix = "fa-solid";
  if (type === "regular") prefix = "fa-regular";
  else if (type === "light") prefix = "fa-light";
  else if (type === "thin") prefix = "fa-thin";
  else if (type === "duotone") prefix = "fa-duotone";
  else if (type === "sharp-solid") prefix = "fa-sharp fa-solid";
  else if (type === "brands") prefix = "fa-brands";

  const iconClass = name.startsWith("fa-") ? name : `fa-${name}`;

  return <i className={cn(prefix, iconClass, "inline-flex items-center justify-center leading-none", className)} {...props} />;
}
